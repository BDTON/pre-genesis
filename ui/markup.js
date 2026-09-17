// Small markup builders so every control uses the same classes from hud.css.
import {esc} from './context.js';
import {icon} from './icons.js';

export const BUTTON_CLASS = Object.freeze({
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  danger: 'btn btn-danger',
  ghost: 'btn btn-ghost',
});

function dataAttributes(data) {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `data-${key.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${esc(value)}"`)
    .join(' ');
}

// Buttons carry a verb label (1–3 words) and an optional sprite icon.
export function button(label, {icon: iconName = '', kind = 'secondary', data = {}, disabled = false, title = '', pressed, id = '', extraClass = ''} = {}) {
  const attrs = [
    'type="button"',
    `class="${BUTTON_CLASS[kind] || BUTTON_CLASS.secondary}${extraClass ? ' ' + extraClass : ''}"`,
    id ? `id="${esc(id)}"` : '',
    dataAttributes(data),
    disabled ? 'disabled' : '',
    title ? `title="${esc(title)}"` : '',
    pressed === undefined ? '' : `aria-pressed="${pressed ? 'true' : 'false'}"`,
  ].filter(Boolean).join(' ');
  return `<button ${attrs}>${iconName ? icon(iconName) : ''}<span>${esc(label)}</span></button>`;
}

// Icon-only buttons always have an accessible name and a matching tooltip.
export function iconButton(iconName, label, {data = {}, disabled = false, id = '', pressed, extraClass = ''} = {}) {
  const attrs = [
    'type="button"',
    `class="icon-button${extraClass ? ' ' + extraClass : ''}"`,
    id ? `id="${esc(id)}"` : '',
    dataAttributes(data),
    `aria-label="${esc(label)}"`,
    `title="${esc(label)}"`,
    disabled ? 'disabled' : '',
    pressed === undefined ? '' : `aria-pressed="${pressed ? 'true' : 'false'}"`,
  ].filter(Boolean).join(' ');
  return `<button ${attrs}>${icon(iconName)}</button>`;
}

export function meter(value, max, {label = '', tone = ''} = {}) {
  const pct = Math.max(0, Math.min(100, 100 * (Number(value) || 0) / (Number(max) || 1)));
  const aria = label ? `role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="${Math.round(max || 0)}" aria-valuenow="${Math.round(value || 0)}"` : 'aria-hidden="true"';
  return `<div class="meter${tone ? ' meter-' + tone : ''}" ${aria}><span style="width:${pct.toFixed(1)}%"></span></div>`;
}

export function stat(iconName, text, label = '') {
  return `<span class="stat" ${label ? `title="${esc(label)}"` : ''}>${icon(iconName, label)}<span>${esc(text)}</span></span>`;
}

export const dialogHead = (title, sub = '') => `<header class="dialog-head illuminated"><h2 id="dialog-title">${esc(title)}</h2>${sub ? `<p class="dialog-sub">${esc(sub)}</p>` : ''}</header>`;
