// Codex: a short first view per faction, with the full dossier one tap away.
import {ctx, ui, $, esc} from './context.js';
import * as g from './game.js';
import {PANTHEONS} from '../mythology.js';
import {FACTION_LORE} from '../faction-lore.js';
import {icon} from './icons.js';
import {portrait, figurePlate} from './portraits.js';
import {button} from './markup.js';
import {modal} from './overlay.js';
import {SOURCE_KINDS} from './text.js';

const paragraphs = items => [].concat(items || []).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');
const sourceLink = s => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}${icon('external')}</a>`;
const pairs = items => `<dl class="pairs">${[].concat(items || []).map(x => `<div><dt>${esc(x.name)}</dt><dd>${esc(x.role || x.meaning)}</dd></div>`).join('')}</dl>`;

function factionOptions(selectedId) {
  const groups = new Map();
  for (const f of g.FACTIONS) {
    if (!groups.has(f.tradition)) groups.set(f.tradition, []);
    groups.get(f.tradition).push(f);
  }
  return [...groups].map(([tradition, list]) => `<optgroup label="${esc(tradition)}">${list.map(f =>
    `<option value="${esc(f.id)}" ${f.id === selectedId ? 'selected' : ''}>${esc(f.leader)}${f.patron && f.patron !== f.leader ? ` · ${esc(f.patron)}` : ''}</option>`).join('')}</optgroup>`).join('');
}

export function showCodex(factionId = ctx.started ? ctx.state.player : ctx.chosenFaction, {full = false} = {}) {
  const f = g.factionMeta(factionId);
  const lore = FACTION_LORE[f.id] || FACTION_LORE[f.sourceKey] || null;
  const pantheon = PANTHEONS[f.id] || PANTHEONS[f.sourceKey] || null;
  const figures = pantheon?.figures || [];
  const trait = g.engine.factionTrait?.(f.id) || f.trait || null;
  const power = g.HERO_POWERS.find(p => p.factionId === f.id);
  const legacyRules = ctx.started && ctx.state.ruleset !== g.TRAIT_RULESET;

  const head = `<header class="codex-head illuminated">${portrait(f.id, {size: 'md', gold: true})}<div>
      <h2 id="dialog-title">${esc(f.leader)}</h2>
      <p class="dialog-sub">${esc([f.patron && f.patron !== f.leader ? f.patron : '', f.tradition, f.name].filter(Boolean).join(' · '))}</p>
    </div></header>
    <label class="field codex-switch"><span class="field-label"><strong>Faction</strong></span><select id="codex-faction">${factionOptions(f.id)}</select></label>`;

  const traitCard = trait ? `<section class="card trait">
      <h3>${esc(trait.name)}</h3>
      <p>${esc(trait.summary)}</p>
      ${trait.weakness ? `<p class="note">Weakness: ${esc(trait.weakness)}</p>` : ''}
      ${legacyRules ? '<p class="note">Applies to new campaigns.</p>' : ''}
      ${power ? `<p><strong>${esc(power.name)}</strong> ${esc(power.description)}</p>` : ''}
    </section>` : '';

  // The plate opens the reading column for a realm whose leader is modelled.
  const plate = figurePlate(f.id, f.leader);
  const opening = text => (plate ? `<div class="codex-opening">${plate}${text}</div>` : text);

  if (!lore) {
    modal(`${head}${opening(`<p class="lead">${esc(f.lore || f.description || '')}</p>`)}${traitCard}
      ${f.sourceUrl ? `<p>${sourceLink({url: f.sourceUrl, title: f.sourceLabel || f.sourceUrl})}</p>` : ''}`, {kind: 'codex', size: 'wide'});
    return;
  }

  const stories = [].concat(lore.stories || []);
  const storyList = stories.map(x => `<details class="disclosure"><summary>${esc(x.title)}</summary><p>${esc(x.text)}</p>
      <p class="citations">${[].concat(x.sourceIds || []).map(id => lore.sources.find(s => s.id === id)).filter(Boolean).map(sourceLink).join('')}</p></details>`).join('');
  const sources = `<details class="disclosure"><summary>Sources (${lore.sources.length})</summary><ol class="sources">${lore.sources.map(s =>
    `<li>${sourceLink(s)}<small>${esc(SOURCE_KINDS[s.kind] || s.kind || '')}</small></li>`).join('')}</ol></details>`;

  let more = '';
  if (full) {
    more = `<details class="disclosure" open><summary>Worldview</summary>${paragraphs(lore.worldview)}</details>
      <details class="disclosure"><summary>Figures</summary>${pairs(lore.relationships)}</details>
      <details class="disclosure"><summary>Symbols</summary>${pairs(lore.symbols)}</details>
      <details class="disclosure"><summary>Practice</summary>${paragraphs(lore.practice)}${paragraphs(lore.variants)}</details>
      ${figures.length ? `<details class="disclosure"><summary>More figures (${figures.length})</summary>${figures.map(x => `<article class="figure">
        <h4>${esc(x.name)}</h4><p class="note">${esc(x.role)}</p><p>${esc(x.lore)}</p>
        ${x.sourceUrl ? `<p>${sourceLink({url: x.sourceUrl, title: x.sourceLabel || x.sourceUrl})}</p>` : ''}</article>`).join('')}</details>` : ''}
      <details class="disclosure"><summary>Game notes</summary><p>${esc(lore.adaptation)}</p>${trait?.loreBasis ? `<p>${esc(trait.loreBasis)}</p>` : ''}<p class="note">Game rules, not doctrine.</p></details>`;
  }

  modal(`${head}
    ${opening(`<p class="lead">${esc(lore.identity)}</p>`)}
    ${traitCard}
    <section class="dialog-section"><h3>Stories (${stories.length})</h3>${storyList}</section>
    ${more}
    ${sources}
    ${full ? '' : `<div class="dialog-actions">${button('Read more', {icon: 'lore', data: {codexMore: f.id}})}</div>`}`, {kind: 'codex', size: 'wide', focus: full ? '.disclosure summary' : '#codex-faction'});
}

export function handleCodexChange(el) {
  if (el.id !== 'codex-faction') return false;
  showCodex(el.value);
  $('#codex-faction')?.focus();
  return true;
}

Object.assign(ui, {showCodex, handleCodexChange});
