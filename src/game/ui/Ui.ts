import { check } from '../../core/conditions';
import type { DialogueRunner } from '../../core/dialogue';
import { SaveError } from '../../core/save';
import type { GameState } from '../../core/state';
import { LEGEND } from '../../core/grid';
import type { MapDef } from '../../core/types';
import { ASSET_ROOT, getManifest } from '../assets';
import { ABILITIES, CHARACTERS, ENEMIES, ITEMS, MAPS, QUESTS } from '../data';
import { session } from '../session';
import { ACTION_LABELS, type Action } from '../systems/Input';
import { TouchControls } from './Touch';

export interface UiHost {
  gameState(): GameState;
  currentMap(): MapDef;
  saveSlot(slot: number): void;
  loadSlot(slot: number): void;
  quit(): void;
  useItem(id: string): void;
  onClose(): void;
  onDialogueSignals(r: DialogueRunner): void;
  applySettings(): void;
}

type Panel = 'pause' | 'inventory' | 'journal' | 'map' | 'options' | 'saves' | null;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function iconUrl(prop?: string): string {
  if (!prop) return '';
  try {
    const m = getManifest().props[prop];
    return m ? ASSET_ROOT + (m.variants?.['2']?.file ?? m.file) : '';
  } catch {
    return '';
  }
}

export class Ui {
  readonly root: HTMLElement;
  readonly touch: TouchControls;
  private hud: HTMLElement;
  private toasts: HTMLElement;
  private promptEl: HTMLElement;
  private dialogueEl: HTMLElement;
  private panelEl: HTMLElement;
  private bannerEl: HTMLElement;
  private loadingEl: HTMLElement;
  private runner: DialogueRunner | null = null;
  private dialogueDone: (() => void) | null = null;
  private choiceIndex = 0;
  private typing = 0;
  private fullText = '';
  panel: Panel = null;
  private journalTab = 'objective';
  private host: UiHost | null = null;
  /** Load handler used from the title screen (no running game). */
  titleLoad: ((slot: number) => void) | null = null;
  private lastHud = '';

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ui';
    this.root.innerHTML = `
      <div class="hud hidden">
        <div class="hud-left"><div class="hud-name"></div><div class="hud-hearts"></div><div class="hud-energy"><i></i></div></div>
        <div class="hud-obj"></div>
        <div class="hud-right"><div class="hud-ability"></div><div class="hud-area"></div></div>
      </div>
      <div class="toasts"></div>
      <div class="prompt hidden"></div>
      <div class="dialogue hidden"><div class="d-speaker"></div><div class="d-text"></div><div class="d-choices"></div><div class="d-next">▼</div></div>
      <div class="panel hidden"></div>
      <div class="banner hidden"></div>
      <div class="loading hidden"><div class="l-art"></div><div class="l-text"></div><div class="l-bar"><i></i></div><div class="l-err"></div></div>`;
    parent.appendChild(this.root);
    this.hud = this.root.querySelector('.hud')!;
    this.toasts = this.root.querySelector('.toasts')!;
    this.promptEl = this.root.querySelector('.prompt')!;
    this.dialogueEl = this.root.querySelector('.dialogue')!;
    this.panelEl = this.root.querySelector('.panel')!;
    this.bannerEl = this.root.querySelector('.banner')!;
    this.loadingEl = this.root.querySelector('.loading')!;
    this.touch = new TouchControls(this.root);
    // clicks on UI never reach the game canvas
    for (const el of [this.dialogueEl, this.panelEl, this.hud]) {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    this.dialogueEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.d-choice')) return;
      this.advance();
    });
    this.hud.querySelector('.hud-obj')!.addEventListener('click', () => this.open('journal'));
    // buttons never keep keyboard focus: Space/Enter belong to the game, not to a stale button
    document.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest?.('button');
      if (b) window.setTimeout(() => b.blur(), 0);
    }, true);
  }

  setHost(h: UiHost | null): void {
    this.host = h;
  }

  get blocking(): boolean {
    return !!this.runner || this.panel !== null || !this.bannerEl.classList.contains('hidden');
  }

  get inDialogue(): boolean {
    return !!this.runner;
  }

  // ------------------------------------------------------------------- HUD
  showHud(v: boolean): void {
    this.hud.classList.toggle('hidden', !v);
  }

  updateHud(s: GameState, mapName: string, objective: string, abilityId: string | undefined): void {
    const hp = s.hp[s.character] ?? s.maxHp;
    const key = `${s.character}|${hp}|${s.maxHp}|${Math.round(s.energy)}|${objective}|${abilityId}|${mapName}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.hud.querySelector('.hud-name')!.textContent = CHARACTERS[s.character]?.name ?? s.character;
    let hearts = '';
    for (let i = 0; i < s.maxHp; i++) hearts += `<span class="${i < hp ? 'h-on' : 'h-off'}">♥</span>`;
    this.hud.querySelector('.hud-hearts')!.innerHTML = hearts;
    (this.hud.querySelector('.hud-energy i') as HTMLElement).style.width = `${(s.energy / s.maxEnergy) * 100}%`;
    this.hud.querySelector('.hud-obj')!.textContent = objective;
    const ab = abilityId ? ABILITIES[abilityId] : null;
    this.hud.querySelector('.hud-ability')!.innerHTML = ab ? `◈ ${esc(ab.name)} <small>${ab.energy ? ab.energy + '⚡' : ''}</small>` : '';
    this.hud.querySelector('.hud-area')!.textContent = mapName;
  }

  toast(text: string, ms = 2600): void {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    // identical messages are not stacked
    for (const c of this.toasts.children) if (c.textContent === text) c.remove();
    this.toasts.appendChild(t);
    const max = window.innerHeight < 480 ? 2 : 4;
    while (this.toasts.children.length > max) this.toasts.firstChild!.remove();
    window.setTimeout(() => t.classList.add('out'), ms);
    window.setTimeout(() => t.remove(), ms + 400);
  }

  prompt(text: string | null): void {
    if (!text) {
      this.promptEl.classList.add('hidden');
      return;
    }
    const touch = session.touchVisible();
    const html = touch ? esc(text) : `<b>${esc(session.input.keyLabel('interact'))}</b> ${esc(text)}`;
    if (this.promptEl.innerHTML !== html) this.promptEl.innerHTML = html;
    this.promptEl.classList.remove('hidden');
  }

  // -------------------------------------------------------------- dialogue
  openDialogue(r: DialogueRunner, done: () => void): void {
    this.runner = r;
    this.dialogueDone = done;
    session.input.setContext('ui');
    this.dialogueEl.classList.remove('hidden');
    this.renderNode();
  }

  private renderNode(): void {
    const v = this.runner?.view;
    if (!v) return this.closeDialogue();
    this.dialogueEl.querySelector('.d-speaker')!.textContent = v.speaker;
    this.fullText = v.text;
    this.typing = 0;
    this.dialogueEl.querySelector('.d-text')!.textContent = '';
    const box = this.dialogueEl.querySelector('.d-choices')!;
    box.innerHTML = '';
    this.choiceIndex = 0;
    this.dialogueEl.classList.toggle('has-choices', v.choices.length > 0);
  }

  private showChoices(): void {
    const v = this.runner?.view;
    if (!v) return;
    const box = this.dialogueEl.querySelector('.d-choices')!;
    box.innerHTML = '';
    v.choices.forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'd-choice' + (i === this.choiceIndex ? ' sel' : '');
      b.innerHTML = `${i + 1}. ${esc(c.text)}${c.tag ? ` <small>[${esc(c.tag)}]</small>` : ''}`;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.choose(i);
      });
      box.appendChild(b);
    });
  }

  private choose(i: number): void {
    if (!this.runner) return;
    session.audio.play('confirm');
    this.runner.choose(i);
    this.host?.onDialogueSignals(this.runner);
    if (this.runner.done) this.closeDialogue();
    else this.renderNode();
  }

  private advance(): void {
    if (!this.runner) return;
    if (this.typing < this.fullText.length) {
      this.typing = this.fullText.length;
      return;
    }
    if (this.runner.visibleChoices().length) return;
    session.audio.play('ui');
    this.runner.advance();
    this.host?.onDialogueSignals(this.runner);
    if (this.runner.done) this.closeDialogue();
    else this.renderNode();
  }

  private closeDialogue(): void {
    this.dialogueEl.classList.add('hidden');
    const done = this.dialogueDone;
    this.runner = null;
    this.dialogueDone = null;
    if (!this.panel) session.input.setContext('world');
    done?.();
  }

  /** Per-frame UI work: typewriter and keyboard navigation in UI context. */
  update(dt: number): void {
    const inp = session.input;
    if (this.runner) {
      if (this.typing < this.fullText.length) {
        this.typing = Math.min(this.fullText.length, this.typing + dt * 60);
        this.dialogueEl.querySelector('.d-text')!.textContent = this.fullText.slice(0, Math.floor(this.typing));
        if (this.typing >= this.fullText.length) this.showChoices();
      }
      const n = this.runner.visibleChoices().length;
      if (n && this.typing >= this.fullText.length) {
        if (inp.consumeUi('up')) { this.choiceIndex = (this.choiceIndex + n - 1) % n; this.showChoices(); }
        if (inp.consumeUi('down')) { this.choiceIndex = (this.choiceIndex + 1) % n; this.showChoices(); }
        if (inp.consumeUi('advance') || inp.consumeUi('interact') || inp.consumeUi('primary')) this.choose(this.choiceIndex);
      } else if (inp.consumeUi('advance') || inp.consumeUi('interact') || inp.consumeUi('primary')) this.advance();
      inp.consumeUi('jump');
      return;
    }
    if (this.panel) {
      if (inp.consumeUi('pause')) this.close();
      for (const [a, p] of [['inventory', 'inventory'], ['journal', 'journal'], ['map', 'map']] as const) {
        if (inp.consumeUi(a)) {
          if (this.panel === p) this.close();
          else this.open(p);
        }
      }
    }
  }

  // ---------------------------------------------------------------- panels
  open(p: Exclude<Panel, null>): void {
    if (this.runner) return;
    this.panel = p;
    session.input.setContext('ui');
    this.panelEl.classList.remove('hidden');
    session.audio.play('ui');
    this.render();
  }

  close(): void {
    this.panel = null;
    this.panelEl.classList.add('hidden');
    this.panelEl.innerHTML = '';
    session.input.setContext('world');
    this.host?.onClose();
  }

  private frame(title: string, body: string, tabs = true): string {
    const t = (id: Exclude<Panel, null>, label: string) => `<button class="tab${this.panel === id ? ' on' : ''}" data-open="${id}">${label}</button>`;
    return `<div class="p-head"><h2>${esc(title)}</h2><button class="p-close" data-close aria-label="Fechar">✕</button></div>
      ${tabs ? `<div class="p-tabs">${t('pause', 'Pausa')}${t('inventory', 'Inventário')}${t('journal', 'Diário')}${t('map', 'Mapa')}${t('saves', 'Gravações')}${t('options', 'Opções')}</div>` : ''}
      <div class="p-body">${body}</div>`;
  }

  private render(): void {
    if (!this.panel) return;
    // saves and options also work from the title screen, where there is no running game
    if (!this.host && this.panel !== 'saves' && this.panel !== 'options') return;
    const s = this.host?.gameState() as GameState;
    let html = '';
    switch (this.panel) {
      case 'pause': html = this.frame('Pausa', `<div class="menu-list">
          <button data-act="resume">Continuar</button>
          <button data-open="saves">Gravar / carregar</button>
          <button data-open="options">Opções e controlos</button>
          <button data-act="quit">Sair para o menu inicial</button></div>
          <p class="muted">Tempo de jogo: ${Math.floor(s.playTime / 60)} min · Arco ${s.arc}</p>`); break;
      case 'inventory': html = this.frame('Inventário', this.inventoryHtml(s)); break;
      case 'journal': html = this.frame('Diário de investigação', this.journalHtml(s)); break;
      case 'map': html = this.frame('Mapa', `<canvas class="minimap"></canvas><div class="areas">${this.areasHtml(s)}</div>`); break;
      case 'saves': html = this.frame('Gravações', this.savesHtml(), !!this.host); break;
      case 'options': html = this.frame('Opções', this.optionsHtml(), !!this.host); break;
    }
    this.panelEl.innerHTML = html;
    this.bindPanel();
    if (this.panel === 'map') this.drawMinimap(s);
  }

  private bindPanel(): void {
    const q = <T extends HTMLElement>(sel: string) => [...this.panelEl.querySelectorAll<T>(sel)];
    for (const b of q('[data-close]')) b.addEventListener('click', () => this.close());
    for (const b of q('[data-open]')) b.addEventListener('click', () => this.open(b.dataset.open as Exclude<Panel, null>));
    for (const b of q('[data-tab]')) b.addEventListener('click', () => { this.journalTab = b.dataset.tab!; this.render(); });
    for (const b of q('[data-use]')) b.addEventListener('click', () => { this.host?.useItem(b.dataset.use!); this.render(); });
    for (const b of q('[data-act]')) {
      b.addEventListener('click', () => {
        const a = b.dataset.act!;
        if (a === 'resume') this.close();
        if (a === 'quit') this.confirm('Sair para o menu inicial? O progresso desde a última gravação perde-se.', () => { this.close(); this.host?.quit(); });
      });
    }
    for (const b of q('[data-save]')) {
      b.addEventListener('click', () => {
        const slot = Number(b.dataset.save);
        const existing = session.saves.list().find((x) => x.slot === slot)?.file;
        const doSave = () => { this.host?.saveSlot(slot); this.render(); };
        if (existing) this.confirm(`Substituir a gravação da ranhura ${slot}?`, doSave);
        else doSave();
      });
    }
    for (const b of q('[data-load]')) {
      b.addEventListener('click', () => {
        const slot = Number(b.dataset.load);
        if (!this.host) { this.close(); this.titleLoad?.(slot); return; }
        this.confirm('Carregar esta gravação? O progresso não gravado perde-se.', () => { this.close(); this.host?.loadSlot(slot); });
      });
    }
    for (const b of q('[data-export]')) b.addEventListener('click', () => this.exportSlot(Number(b.dataset.export)));
    for (const b of q('[data-import]')) b.addEventListener('click', () => this.importSlot(Number(b.dataset.import)));
    for (const b of q('[data-delete]')) b.addEventListener('click', () => this.confirm('Apagar esta gravação?', () => { session.saves.remove(Number(b.dataset.delete)); this.render(); }));
    this.bindOptions();
  }

  confirm(text: string, yes: () => void): void {
    const d = document.createElement('div');
    d.className = 'confirm';
    d.innerHTML = `<div class="c-box"><p>${esc(text)}</p><div class="c-row"><button class="c-yes">Sim</button><button class="c-no">Não</button></div></div>`;
    d.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.appendChild(d);
    const prevCtx = session.input.context;
    session.input.setContext('ui');
    const done = () => { d.remove(); session.input.setContext(prevCtx); };
    d.querySelector('.c-yes')!.addEventListener('click', () => { done(); yes(); });
    d.querySelector('.c-no')!.addEventListener('click', done);
    (d.querySelector('.c-no') as HTMLElement).focus();
  }

  private inventoryHtml(s: GameState): string {
    const items = Object.entries(s.inventory).filter(([, n]) => n > 0);
    if (!items.length) return '<p class="muted">Ainda não tens objectos.</p>';
    return `<div class="inv">${items.map(([id, n]) => {
      const it = ITEMS[id];
      const icon = iconUrl(it?.icon);
      return `<div class="inv-item">${icon ? `<img src="${icon}" alt="">` : ''}<div><b>${esc(it?.name ?? id)}</b>${n > 1 ? ` ×${n}` : ''}${it?.key ? ' <small class="key">essencial</small>' : ''}
        <p>${esc(it?.description ?? '')}</p>${it?.use ? `<button data-use="${id}">Usar</button>` : ''}</div></div>`;
    }).join('')}</div>
    <h3>Capacidades</h3><ul class="abil">${s.abilities.map((a) => `<li><b>${esc(ABILITIES[a]?.name ?? a)}</b> <small>(${esc(CHARACTERS[ABILITIES[a]?.owner]?.name ?? '')})</small> — ${esc(ABILITIES[a]?.description ?? '')}</li>`).join('') || '<li class="muted">Nenhuma ainda.</li>'}</ul>`;
  }

  private journalHtml(s: GameState): string {
    const tab = (id: string, label: string) => `<button class="tab${this.journalTab === id ? ' on' : ''}" data-tab="${id}">${label}</button>`;
    let body = '';
    const active = Object.entries(s.quests).filter(([, q]) => q.state === 'active').map(([id, q]) => ({ def: QUESTS[id], q })).filter((x) => x.def && x.def.arc === s.arc);
    if (this.journalTab === 'objective') {
      body = active.length ? active.sort((a, b) => Number(b.def.main) - Number(a.def.main)).map(({ def, q }) => {
        const step = def.steps[q.step];
        return `<div class="quest ${def.main ? 'main' : ''}"><h3>${def.main ? '★ ' : ''}${esc(def.title)}</h3><p>${esc(def.summary)}</p>
          ${step ? `<p class="now"><b>Agora:</b> ${esc(step.text)}</p><p class="hint"><b>Próximo passo:</b> ${esc(step.hint)}</p>` : ''}
          ${def.reward ? `<p class="muted">Recompensa / consequência: ${esc(def.reward)}</p>` : ''}</div>`;
      }).join('') : '<p class="muted">Nenhum objectivo activo. Explora e fala com as pessoas.</p>';
    } else if (this.journalTab === 'quests') {
      body = Object.entries(s.quests).map(([id, q]) => ({ def: QUESTS[id], q })).filter((x) => x.def).map(({ def, q }) => {
        const st = { active: 'em curso', done: 'concluída', failed: 'falhada', inactive: '' }[q.state];
        return `<div class="quest ${q.state}"><h3>${esc(def.title)} <small>(${st}, arco ${def.arc})</small></h3><ol>${def.steps.map((stp, i) => `<li class="${i < q.step || q.state === 'done' ? 'done' : i === q.step && q.state === 'active' ? 'cur' : 'todo'}">${i <= q.step || q.state === 'done' ? esc(stp.text) : '???'}</li>`).join('')}</ol></div>`;
      }).join('') || '<p class="muted">Sem missões.</p>';
    } else if (this.journalTab === 'clues') {
      body = s.journal.length ? `<ul class="clues">${[...s.journal].reverse().map((j) => `<li>${esc(j.text)}</li>`).join('')}</ul>` : '<p class="muted">Sem pistas.</p>';
    } else if (this.journalTab === 'choices') {
      const bar = (label: string, v: number, min: number, max: number) => `<div class="bar"><span>${label}</span><div><i style="width:${((v - min) / (max - min)) * 100}%"></i></div><small>${v}</small></div>`;
      const ev = (label: string, list: string[]) => list.length ? `<p><b>${label}:</b> ${list.map(esc).join(', ')}</p>` : '';
      body = `${bar('Empatia', s.vars.empathy, -20, 20)}${bar('Ambição', s.vars.ambition, -20, 20)}${bar('Confiança', s.vars.trust, -20, 20)}${bar('Integridade da realidade', s.vars.reality, 0, 20)}${bar('Dívida temporal', s.vars.timeDebt, 0, 20)}
        ${ev('Ajudados', s.events.helped)}${ev('Resgatados', s.events.rescued)}${ev('Promessas cumpridas', s.events.promisesKept)}${ev('Promessas quebradas', s.events.promisesBroken)}${ev('Reparados', s.events.repaired)}${ev('Acordos', s.events.deals)}${ev('Portais usados', s.events.portals)}${ev('Sacrificado', s.events.sacrificed)}
        ${s.arc1Ending ? `<p class="ending">Desfecho do arco de Bill: <b>${esc({ repair: 'Reparação e preservação', exile: 'Exílio e ruptura incompleta', ascension: 'Ascensão e domínio dimensional' }[s.arc1Ending])}</b></p>` : ''}`;
    } else {
      const known = Object.keys(ENEMIES).filter((k) => s.flags[`scanned:${k}`]);
      body = known.length ? known.map((k) => `<div class="quest"><h3>${esc(ENEMIES[k].name)}</h3><p>${esc(BESTIARY[k] ?? '')}</p></div>`).join('') : '<p class="muted">Usa o diário do Dipper (capacidade "Analisar") para registar criaturas.</p>';
    }
    return `<div class="p-tabs sub">${tab('objective', 'Objectivo')}${tab('quests', 'Missões')}${tab('clues', 'Pistas')}${tab('choices', 'Consequências')}${tab('bestiary', 'Bestiário')}</div>${body}`;
  }

  private areasHtml(s: GameState): string {
    const list = Object.values(MAPS).filter((m) => m.arc === s.arc || s.visited.includes(m.id));
    return `<h3>Áreas</h3><ul>${list.map((m) => `<li class="${m.id === s.mapId ? 'here' : s.visited.includes(m.id) ? 'seen' : 'unknown'}">${s.visited.includes(m.id) ? esc(m.name) : '???'}${m.id === s.mapId ? ' ◀ estás aqui' : ''}</li>`).join('')}</ul>`;
  }

  private drawMinimap(s: GameState): void {
    const c = this.panelEl.querySelector<HTMLCanvasElement>('.minimap');
    const map = this.host?.currentMap();
    if (!c || !map) return;
    const scale = Math.max(2, Math.floor(Math.min(520 / map.width, 300 / map.height)));
    c.width = map.width * scale;
    c.height = map.height * scale;
    const ctx = c.getContext('2d')!;
    const explored = new Set(s.explored[map.id] ?? []);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const chunk = Math.floor(y / 4) * 64 + Math.floor(x / 4);
      ctx.fillStyle = explored.has(chunk) ? LEGEND[map.terrain[y][x]]?.color ?? '#000' : '#0d0b0a';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
    for (const e of map.exits) {
      if (!explored.has(Math.floor(e.y / 4) * 64 + Math.floor(e.x / 4))) continue;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(e.x * scale, e.y * scale, Math.max(1, e.w) * scale, Math.max(1, e.h) * scale);
    }
    ctx.fillStyle = '#ff4060';
    ctx.fillRect((s.pos.x / 32) * scale - 2, (s.pos.y / 32) * scale - 3, 5, 5);
  }

  private savesHtml(): string {
    const rows = session.saves.list().map(({ slot, file, error }) => {
      const info = file ? `<b>${esc(file.summary.mapName)}</b> · ${esc(CHARACTERS[file.summary.character]?.name ?? '')} · arco ${file.summary.arc} · ${Math.floor(file.summary.playTime / 60)} min<br><small>${new Date(file.savedAt).toLocaleString('pt-PT')}</small>` : error ? `<span class="err">Inválida: ${esc(error)}</span>` : '<span class="muted">Vazia</span>';
      return `<div class="slot"><div class="s-info"><span class="s-n">${slot}</span>${info}</div><div class="s-act">
        ${this.host ? `<button data-save="${slot}">Gravar aqui</button>` : ''}${file ? `<button data-load="${slot}">Carregar</button><button data-export="${slot}">Exportar</button>` : ''}
        <button data-import="${slot}">Importar</button>${file || error ? `<button data-delete="${slot}">Apagar</button>` : ''}</div></div>`;
    });
    return `${rows.join('')}<p class="muted">O jogo grava automaticamente na ranhura activa (${session.slot}) ao mudar de área, em pontos de descanso, ao concluir missões e depois de escolhas importantes.</p><div class="io hidden"><textarea spellcheck="false"></textarea><div class="c-row"><button class="io-ok">Importar texto</button><button class="io-copy">Copiar</button><button class="io-close">Fechar</button></div></div>`;
  }

  private exportSlot(slot: number): void {
    try {
      const text = session.saves.exportText(slot);
      const blob = new Blob([text], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gravity-falls-gravacao-${slot}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      // WebViews may ignore downloads: also expose the text for copying
      const io = this.panelEl.querySelector('.io') as HTMLElement;
      io.classList.remove('hidden');
      (io.querySelector('textarea') as HTMLTextAreaElement).value = text;
      (io.querySelector('.io-ok') as HTMLElement).classList.add('hidden');
      io.querySelector('.io-copy')!.addEventListener('click', () => void navigator.clipboard?.writeText(text).then(() => this.toast('Copiado.')));
      io.querySelector('.io-close')!.addEventListener('click', () => io.classList.add('hidden'));
    } catch (e) {
      this.toast((e as Error).message);
    }
  }

  private importSlot(slot: number): void {
    const io = this.panelEl.querySelector('.io') as HTMLElement;
    io.classList.remove('hidden');
    const ta = io.querySelector('textarea') as HTMLTextAreaElement;
    ta.value = '';
    ta.placeholder = 'Cola aqui o texto da gravação, ou escolhe um ficheiro…';
    const ok = io.querySelector('.io-ok') as HTMLElement;
    ok.classList.remove('hidden');
    const doImport = (text: string) => {
      const existing = session.saves.list().find((x) => x.slot === slot)?.file;
      const run = () => {
        try {
          session.saves.importText(slot, text);
          this.toast(`Gravação importada para a ranhura ${slot}.`);
          this.render();
        } catch (e) {
          this.toast(e instanceof SaveError ? e.message : 'Falha ao importar.');
        }
      };
      if (existing) this.confirm(`Substituir a gravação da ranhura ${slot}?`, run);
      else run();
    };
    ok.onclick = () => doImport(ta.value);
    io.querySelector('.io-close')!.addEventListener('click', () => io.classList.add('hidden'));
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.onchange = () => { const f = file.files?.[0]; if (f) void f.text().then(doImport); };
    file.click();
  }

  private optionsHtml(): string {
    const st = session.settings;
    const range = (id: string, label: string, v: number, min = 0, max = 1, step = 0.05) => `<label class="opt"><span>${label}</span><input type="range" data-opt="${id}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
    const toggle = (id: string, label: string, v: boolean) => `<label class="opt"><span>${label}</span><input type="checkbox" data-opt="${id}" ${v ? 'checked' : ''}></label>`;
    const binds = (Object.keys(ACTION_LABELS) as Action[]).map((a) => `<div class="bind"><span>${ACTION_LABELS[a]}</span>${[0, 1].map((i) => `<button data-bind="${a}" data-i="${i}">${esc(session.input.bindings[a][i] ?? '—')}</button>`).join('')}</div>`).join('');
    return `<h3>Áudio</h3>${range('masterVolume', 'Volume geral', st.masterVolume)}${range('musicVolume', 'Música', st.musicVolume)}${range('sfxVolume', 'Efeitos', st.sfxVolume)}
      <h3>Ecrã</h3>${toggle('screenShake', 'Tremor de câmara', st.screenShake)}${toggle('reducedEffects', 'Reduzir efeitos intensos', st.reducedEffects)}${toggle('debug', 'Modo de depuração (F3)', session.debug)}
      <label class="opt"><span>Renderizador <small>(reinicia o jogo)</small></span><select data-opt="renderer"><option value="auto" ${st.renderer === 'auto' ? 'selected' : ''}>Automático (WebGL)</option><option value="canvas" ${st.renderer === 'canvas' ? 'selected' : ''}>Canvas 2D (compatibilidade)</option></select></label>
      <h3>Controlos tácteis</h3><label class="opt"><span>Mostrar</span><select data-opt="touchControls"><option value="auto" ${st.touchControls === 'auto' ? 'selected' : ''}>Automático</option><option value="on" ${st.touchControls === 'on' ? 'selected' : ''}>Sempre</option><option value="off" ${st.touchControls === 'off' ? 'selected' : ''}>Nunca</option></select></label>
      ${range('touchScale', 'Tamanho', st.touchScale, 0.75, 1.5, 0.05)}${range('touchOpacity', 'Opacidade', st.touchOpacity, 0.3, 1, 0.05)}
      <h3>Teclado</h3><p class="muted">Clica numa tecla e prime a nova. O rato: botão esquerdo = acção principal; apontar no mundo orienta capacidades.</p>${binds}
      <div class="c-row"><button data-reset-binds>Repor teclas</button></div>`;
  }

  private bindOptions(): void {
    for (const el of this.panelEl.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-opt]')) {
      el.addEventListener('input', () => {
        const id = el.dataset.opt!;
        const st = session.settings as unknown as Record<string, unknown>;
        if (id === 'debug') session.debug = (el as HTMLInputElement).checked;
        else if (el instanceof HTMLInputElement && el.type === 'checkbox') st[id] = el.checked;
        else if (el instanceof HTMLInputElement) st[id] = Number(el.value);
        else st[id] = el.value;
        session.saveSettings();
        this.touch.applySettings();
        this.host?.applySettings();
        if (id === 'renderer') this.confirm('Reiniciar agora para mudar o renderizador? O progresso não gravado perde-se.', () => location.reload());
      });
    }
    for (const b of this.panelEl.querySelectorAll<HTMLElement>('[data-bind]')) {
      b.addEventListener('click', () => {
        b.textContent = 'prime uma tecla…';
        session.input.onAnyKey = (code) => {
          session.input.setBinding(b.dataset.bind as Action, Number(b.dataset.i), code);
          session.saveSettings();
          this.render();
          return true;
        };
      });
    }
    this.panelEl.querySelector('[data-reset-binds]')?.addEventListener('click', () => { session.input.resetBindings(); session.saveSettings(); this.render(); });
  }

  // --------------------------------------------------------- banners/loading
  banner(title: string, text: string, ms = 0, onDone?: () => void, art?: string): void {
    this.bannerEl.innerHTML = `<div class="b-box">${art ? `<img src="${art}" alt="">` : ''}<h1>${esc(title)}</h1>${text.split('\n').map((p) => `<p>${esc(p)}</p>`).join('')}${ms ? '' : '<button class="b-ok">Continuar</button>'}</div>`;
    this.bannerEl.classList.remove('hidden');
    session.input.setContext('ui');
    let finished = false;
    const finish = () => {
      // idempotent: a stale button can never re-run the continuation
      if (finished) return;
      finished = true;
      this.bannerEl.classList.add('hidden');
      this.bannerEl.innerHTML = '';
      if (!this.panel && !this.runner) session.input.setContext('world');
      onDone?.();
    };
    if (ms) window.setTimeout(finish, ms);
    else this.bannerEl.querySelector('.b-ok')!.addEventListener('click', finish, { once: true });
  }

  areaTitle(name: string): void {
    for (const old of this.root.querySelectorAll('.area-title')) old.remove();
    const t = document.createElement('div');
    t.className = 'area-title';
    t.textContent = name;
    this.root.appendChild(t);
    window.setTimeout(() => t.remove(), 2600);
  }

  loading(show: boolean, text = '', progress = 0, art?: string): void {
    this.loadingEl.classList.toggle('hidden', !show);
    if (!show) return;
    this.loadingEl.querySelector('.l-text')!.textContent = text;
    (this.loadingEl.querySelector('.l-bar i') as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
    const artEl = this.loadingEl.querySelector('.l-art') as HTMLElement;
    artEl.style.backgroundImage = art ? `url(${art})` : '';
  }

  loadingError(lines: string[]): void {
    this.loadingEl.querySelector('.l-err')!.innerHTML = lines.map((l) => `<div>⚠ ${esc(l)}</div>`).join('');
  }
}

const BESTIARY: Record<string, string> = {
  bola8: 'Força bruta. Antes do golpe pesado ergue os braços (círculo vermelho). Depois do golpe fica exposto ~1 s: ataca então.',
  pyronica: 'Mantém distância e lança fogo. As zonas de fogo ficam activas algum tempo: sai do círculo. Com confiança elevada, aceita negociar.',
  hectorgon: 'Escudo frontal. Depois de lançar o padrão de linhas, o escudo cai durante 2 s. Ataca pelas costas ou nessa janela.',
  keyhole: 'Fechado (azul) é invulnerável. Abre-se em ciclos; a lanterna do Dipper força a abertura.',
  teeth: 'Investidas rápidas em linha recta, anunciadas por uma faixa. Desvia-te para o lado. A lanterna atordoa-o.',
  time_agent: 'Não magoa: a estase envia-te para o último ponto de controlo. Pode ser atordoado temporariamente.',
  cyclock: 'Torre fixa que dispara em leque. Usa obstáculos para bloquear os projécteis.',
  time_baby: 'Fases anunciadas por texto. Só fica vulnerável nos períodos de recuperação ("oportunidade!"). Há outra forma de o acalmar…',
  shard: 'Fragmento instável da ruptura. Investe em linha recta.',
};

export function conditionHolds(c: unknown, s: GameState): boolean {
  return check(c as never, s);
}
