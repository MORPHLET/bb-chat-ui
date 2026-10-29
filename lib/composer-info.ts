import { composerInfoReflow } from "./composer-info-reflow.ts";
import { addedMutationRoots } from "./mutation-roots.ts";
import { pillSlot, pillStyle } from "./pill.ts";
import { composerDataChanged, readInfoData, readDiffData } from "./composer-data.ts";
import { exposedInfo, infoKinds, listedInfo, type InfoKind } from "./composer-info-settings.ts";
import { HEAD_DIFF_MARK, openChangesPanel } from "./workspace-diff-pill.ts";
import { commitIcon, fileStatusIcon } from "./composer-diff-icons.ts";
import { childInitial, type ChildState, type ChildSummary } from "./composer-child.ts";
import { DARK_GLASS_FACE, LIGHT_GLASS_FACE } from "./glass-surface.ts";
import { eventHop, pressPop } from "./motion.ts";
import { queueLiquid, type QueueLiquidMotion } from "./queue-liquid.ts";
import { isDesktopChrome, LARGE_HIT_TARGET } from "./device-chrome.ts";
import { infoStack } from "./composer-info-stack.ts";
import { bodyFadeBox, readBodyFadeClips } from "./body-fade.ts";
import { attachQueueControls } from "./composer-queue-controls.ts";
import { interceptPrMerge } from "./composer-pr-merge.ts";
import { createBackgroundAccordions } from "./background-activity.ts";
import { CARD_CLOSE_MASK, nativeActionMenuCss, cardFaceCss, cardSlot, cardStyle, createCardAction, createCardClose, createCardHead, infoCardCss } from "./info-card.ts";

const STACK = "[data-promptbox-shell] > .grid";
const MARK = "data-bb-chat-ui-info";
const UNIT = `${MARK}-unit`;
const WRAP = `${MARK}-wrap`;
const OPEN = `${MARK}-open`;
const SOURCE = `${MARK}-settings`;
const REQUEST = ['tool-use-ask', 'plugin-request-banner', 'plan-review-request', 'approval-banner', 'user-question-banner', 'plan-review-banner'].map(id => `[data-testid="${id}"]`).join(", ");
const GUARDED_STACK = `:where(${STACK}):is([${MARK}-stack], [${MARK}-guard])`;
const PENDING_CARD = `:not(:where([${WRAP}], [${MARK}-bar], [${MARK}-body-fade], [${OPEN}], ${REQUEST}, [${MARK}-holds-request]))`;
const QUESTION = ['tool-use-ask', 'plugin-request-banner', 'user-question-banner'].map(id => `[data-testid="${id}"]`).join(", ");
const HOST_JUMP = 'button[aria-label="Scroll to latest event"]';
// Child avatars are 30px circles overlapping by 12px, so each circle adds 18px.
const AVATAR_STEP = 18;
const NATIVE = `section[aria-label], .agentation-staging-shell, [${MARK}-kind]`;
const WORKFLOW_COLLAPSE = 'button[aria-label^="Collapse "][aria-label$=" workflows"][aria-controls]';
const ARCHIVED = '[aria-label="Thread archived"], [aria-label="Thread is archived"], [aria-label="Archived thread"]';
const UNAVAILABLE = ["Environment unavailable", "Machine removed", "Machine removal in progress", "Machine cleanup failed", "Workspace removed"].map(label => `[aria-label="${label}"]`).join(", ");
const DETAIL = `${STACK}[${MARK}-stack] [${UNIT}][${OPEN}]:not([hidden])`;
const NATIVE_DETAIL = `${DETAIL}:is(${["Thread context before sending", "Child threads", "Prompt mode", "Goal", "To-do list", "Workflow", "Background commands", "Background agents", "Background activity", "Machine status", "Thread history", "Model fallback"].map(label => `section[aria-label="${label}"]`).join(",")})`;
const PROTECTED_SURFACE = "input, textarea, select, pre, code, [contenteditable='true'], .cm-editor, .cm-content, .monaco-editor";
const PROTECTED_EXCLUDE = `:not(${PROTECTED_SURFACE}):not(${PROTECTED_SURFACE.split(", ").map(selector => `${selector} *`).join(", ")})`;
const LEGACY_ROW = `:is([class~="bg-background/70"], [class~="bg-destructive/5"]):not(${PROTECTED_SURFACE}):not(${PROTECTED_SURFACE.split(", ").map(selector => `${selector} *`).join(", ")})`;
const WORKFLOW_LIST_ROW = `${DETAIL}[${OPEN}="workflow"] section[role="region"] :is(div[class~="min-h-7"], button[class~="min-h-7"], button[aria-expanded], div[class~="items-center"][class~="gap-1.5"])`;
const WORKFLOW_PHASES = `${DETAIL}[${OPEN}="workflow"] [data-detail-scroll-area] > div[class~="flex-col"][class~="gap-1.5"]`;
const WORKFLOW_PHASE_ROW = `${WORKFLOW_PHASES} > div > button[aria-expanded], ${WORKFLOW_PHASES} > div[class~="items-center"]`;
const WORKFLOW_AGENT_ROW = `${DETAIL}[${OPEN}="workflow"] section[role="region"] [class~="min-h-7"]:has(> span[class~="truncate"])`;
const LIST_ROW = `${DETAIL}[${OPEN}="todos"] ul > li[class], ${WORKFLOW_LIST_ROW}, ${DETAIL}[${OPEN}="background"] #thread-background-commands-card-body > div > div > div[class~="px-3"]`;
const BACKGROUND_SINGLE_ROW = `${DETAIL}[${OPEN}="background"] [aria-label^="Background command:"][class]:not([${cardSlot.head}])`;
const LIST_DETAIL = `${DETAIL}[aria-label]:is([${OPEN}="todos"], [${OPEN}="workflow"], [${OPEN}="background"], [${OPEN}="children"])`;
const NATIVE_BODY = [
  `${DETAIL}[aria-label="Child threads"] ul`,
  `${DETAIL}[aria-label="Goal"] #thread-goal-card-body > div > div`,
  `${DETAIL}[${OPEN}="background"] #thread-background-commands-card-body > div > div[class~="flex-col"]`,
  `${DETAIL}[${OPEN}="workflow"] [data-detail-scroll-area]`,
  `${DETAIL}[${OPEN}="queue"] [data-queued-messages-scroll]`,
  `${DETAIL}[${OPEN}="queue"] [data-queued-messages-scroll] > ul:not([data-bb-chat-ui-queue-end-boundary="true"])`,
].join(", ");
const WORKFLOW_HEADING = `${DETAIL}[aria-label="Workflow"][${OPEN}="workflow"] > button[${MARK}-close-heading][${MARK}-readonly-title][aria-label^="Workflow:"]`;

const GITHUB_MARK = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>')}")`;

// Fit measured pills into one row, with essentials first. The folded stack reserves its own width.
export function fitComposerInfo(items: readonly { key: string; width: number }[], width: number): string[] {
  let used = 0;
  const result: string[] = [];
  const rank = (key: string) => key === "diff" ? 0 : key === "children" ? 1 : 2;
  for (const item of [...items].sort((a, b) => rank(a.key) - rank(b.key))) {
    const needed = item.width + (used ? 8 : 0);
    if (used + needed > Math.max(0, width - 40)) continue;
    used += needed;
    result.push(item.key);
  }
  return result;
}

export function scrollOverflowEdges(metrics: { scrollTop: number; clientHeight: number; scrollHeight: number }): { above: boolean; below: boolean } {
  if (metrics.scrollHeight <= metrics.clientHeight + 1) return { above: false, below: false };
  return {
    above: metrics.scrollTop > 1,
    below: metrics.scrollTop + metrics.clientHeight < metrics.scrollHeight - 1,
  };
}

const CARD_ROOT = `[${MARK}-menu], ${DETAIL}`;
const PILL = `:is([${pillSlot.navigation}], [${MARK}-stack-kind], [${MARK}-all], [${MARK}-bar][${MARK}-layout="dock"] > [${MARK}-jump])`;

const composerInfoPrefix = `
${infoCardCss(CARD_ROOT, "[data-promptbox-shell]")}
[${MARK}-stack] { --bb-chat-ui-info-max-height:min(50dvh,26rem); --bb-chat-ui-info-face:${LIGHT_GLASS_FACE}; --bb-chat-ui-info-edge:color-mix(in oklab,var(--popover) 35%,transparent); --bb-chat-ui-info-shadow:color-mix(in oklab,var(--ink,var(--foreground)) 22%,transparent); position:relative; display:block !important; overflow:visible !important; }
.dark [${MARK}-stack] { --bb-chat-ui-info-face:${DARK_GLASS_FACE}; --bb-chat-ui-info-edge:color-mix(in oklab,var(--foreground) 8%,transparent); --bb-chat-ui-info-shadow:color-mix(in oklab,black 60%,transparent); }
[${MARK}-stack]::after { display:none !important; }
[${WRAP}] { display:contents !important; }
[${UNIT}] { display:none !important; }
/* Native replacements must not paint full cards while the next frame classifies them. */
${GUARDED_STACK} > ${PENDING_CARD}, ${GUARDED_STACK} [${WRAP}] > ${PENDING_CARD} { display:none !important; }
[${MARK}-stack]:not(:has([${SOURCE}])) [${MARK}-bar] { visibility:hidden !important; pointer-events:none !important; }
[${MARK}-bar] { position:relative; display:flex; align-items:center; gap:8px; height:32px; min-width:0; padding-right:0; }
[${MARK}-bar][hidden] { display:none; }
[${MARK}-all][hidden] { display:none; }
[${MARK}-bar][${MARK}-archived] { padding-right:0; }
[${MARK}-bar][${MARK}-archived] [${MARK}-trigger="status"] { width:100%; max-width:none; justify-content:center; }
[${MARK}-unarchive]:disabled { opacity:.5; cursor:default; }
[${MARK}-archived-detail] [${MARK}-unarchive] { display:flex; width:100%; }
/* Pills only: a card inside the bar keeps its slot sizes. */
${PILL}, [${MARK}-jump] { font:inherit; cursor:pointer; color:var(--foreground); }
[${MARK}-bar] button:focus-visible { outline:2px solid var(--ring); outline-offset:3px; }
[${MARK}-trigger], [${MARK}-stack-kind], [${MARK}-all] { ${pillStyle.navigation} }
[${MARK}-trigger] { width:auto; min-width:0; }
/* Pills are the only frost outside a card. Controls inside a card sit flat on its face (info-card.ts). */
/* Active child stacks paint only their circles; the inactive child icon still owns a pill face. */
${PILL}:not(:where([${MARK}-trigger="children"]:not([${MARK}-unavailable]))) { ${pillStyle.navigationFace} }
[${MARK}-panel-source] { display:none !important; }
[${MARK}-title-source] { display:none !important; }
[${MARK}-stack] [${MARK}-collapse] { display:none !important; }
/* Native cards already have a gutter on layout wrappers; the popover supplies it once. */
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="parent"][${MARK}-with-parent-row] :is(#thread-prompt-banner-git-toggle, #thread-prompt-banner-git-body, #thread-prompt-banner-parent-thread-toggle, [aria-label^="Pull request "]),
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="parent"][${MARK}-with-parent-row] > [${MARK}-parent-toggle-wrap],
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="pullRequest"] :is(#thread-prompt-banner-git-toggle, #thread-prompt-banner-parent-thread-toggle, #thread-prompt-banner-parent-thread-body) { display:none !important; }
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="parent"][${MARK}-with-parent-row] > :not([${MARK}-parent-row]):not([${MARK}-dismiss]):not([${cardSlot.head}]),
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="parent"][${MARK}-with-parent-row] #thread-prompt-banner-parent-thread-body,
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="parent"][${MARK}-with-parent-row] :is(svg, [data-icon-root]):not([${MARK}-parent-row] *):not([${cardSlot.head}] *):not([${cardSlot.close}] *),
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="parent"][${MARK}-with-parent-row]:not([${MARK}-with-parent-body]) :is([${MARK}-parent-link-wrap], a[href*="/threads/"]) { display:none !important; }
${NATIVE_DETAIL} :is(div[class~="px-3"],p[class~="px-3"],ul[class~="px-3"],ul[class~="px-2.5"]):not([${cardSlot.head}]) { padding-left:0 !important; padding-right:0 !important; }
${NATIVE_DETAIL} > button[aria-expanded][aria-controls][class~="px-3"]:not([${cardSlot.head}]) { padding-left:0 !important; padding-right:0 !important; }
${NATIVE_DETAIL} > div > button[aria-expanded][aria-controls]:is([class~="px-3"],[class~="px-2"]):not([${cardSlot.head}]) { padding-left:0 !important; padding-right:0 !important; }
${NATIVE_DETAIL} > div[class~="p-1"]:not([${cardSlot.head}]), ${NATIVE_DETAIL} > div[class~="p-1"] > div[class~="px-2"]:not([${cardSlot.head}]) { padding-left:0 !important; padding-right:0 !important; }
${DETAIL}[aria-label="To-do list"] ul[class~="px-2.5"] > li[class~="px-2"] { margin-left:calc(-1 * var(--bb-chat-ui-card-row-pad)); margin-right:calc(-1 * var(--bb-chat-ui-card-row-pad)); width:calc(100% + 2 * var(--bb-chat-ui-card-row-pad)); box-sizing:border-box; }
${DETAIL} [${MARK}-readonly-title] { cursor:default !important; background:transparent !important; box-shadow:none !important; }
${DETAIL} [${cardSlot.head}] > button[${MARK}-readonly-title] { display:flex; align-items:center; flex:0 1 auto; gap:var(--bb-chat-ui-card-gap); min-width:0; min-height:var(--bb-chat-ui-card-head); height:var(--bb-chat-ui-card-head); padding:0 !important; ${cardStyle.titleText} }
/* Keep native title, live counters and phase bars on their original parents. */
${WORKFLOW_HEADING} { height:auto; display:grid; grid-template-columns:14px auto auto minmax(0,1fr); grid-template-rows:var(--bb-chat-ui-card-head) auto; gap:2px 8px; align-items:center; padding:0 var(--bb-chat-ui-card-close-gutter) 6px 0 !important; }
${WORKFLOW_HEADING} > [${MARK}-title-icon] { grid-column:1; grid-row:1; }
${WORKFLOW_HEADING} > span[class~="flex-1"] { display:contents; }
${WORKFLOW_HEADING} > span[class~="flex-1"] > span:first-child { grid-column:2 / -1; grid-row:1; }
${WORKFLOW_HEADING} > span[class~="flex-1"] > span:nth-child(2) { grid-column:1 / 3; grid-row:2; }
${WORKFLOW_HEADING} > span[class~="flex-1"] > span:nth-child(3) { grid-column:3; grid-row:2; }
${WORKFLOW_HEADING} > [role="presentation"] { grid-column:4; grid-row:2; width:64px; max-width:100%; }
${WORKFLOW_HEADING} > span[class~="ml-auto"] { display:none; }
/* Current runs put the title button inside the controls group, under an Active workflows host. */
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] { height:auto; position:relative; display:grid !important; grid-template-columns:14px fit-content(calc(100% - var(--bb-chat-ui-card-workflow-title-reserve))) var(--bb-chat-ui-card-icon) minmax(0,1fr); grid-template-rows:var(--bb-chat-ui-card-head) auto 12px; align-items:center; column-gap:var(--bb-chat-ui-card-gap); row-gap:2px; margin:0 0 var(--bb-chat-ui-card-gap); padding:0 var(--bb-chat-ui-card-close-gutter) 0 0 !important; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > [${MARK}-panel-action] { grid-column:3; grid-row:1; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > [${MARK}-title-icon] { grid-column:1; grid-row:1; }
/* Flatten only the read-only title layout. Native controls and their handlers keep their parents. */
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > button[aria-label^="Workflow:"] { display:contents !important; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > button[aria-label^="Workflow:"] > span[class~="flex-1"] { display:contents; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > button[aria-label^="Workflow:"] > span[class~="flex-1"] > span:first-child { grid-column:2; grid-row:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > button[aria-label^="Workflow:"] > span[class~="flex-1"] > span:nth-child(2) { grid-column:1 / 3; grid-row:2; white-space:nowrap; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > button[aria-label^="Workflow:"] > span[class~="flex-1"] > span:nth-child(3) { grid-column:3 / -1; grid-row:2; justify-self:end; white-space:nowrap; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > button[aria-label^="Workflow:"] > :is([role="presentation"], div[class~="w-16"]) { position:static; grid-column:1 / -1; grid-row:3; width:100%; max-width:none; height:3px; min-height:3px; overflow:hidden; border-radius:999px; }
${DETAIL}[${OPEN}="workflow"] [${MARK}-title-heading="workflow"][role="group"] > button[aria-label^="Workflow:"] > span[class~="ml-auto"] { display:none; }
${DETAIL}[${OPEN}="workflow"] section[role="region"] :is(div[class~="min-h-7"], button[class~="min-h-7"], button[aria-expanded], div[class~="items-center"][class~="gap-1.5"]) { min-width:0; }
${DETAIL}[${OPEN}="workflow"] section[role="region"] :is(div[class~="min-h-7"], button[class~="min-h-7"], button[aria-expanded], div[class~="items-center"][class~="gap-1.5"]) :is([class~="truncate"], [class~="min-w-0"], [class~="flex-1"]) { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
${DETAIL}[${OPEN}="workflow"] section[role="region"] { grid-template-columns:minmax(0,1fr); }
${DETAIL}[${OPEN}="workflow"] section[role="region"] > div { min-width:0; }
${WORKFLOW_LIST_ROW} > span[class~="font-medium"] { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
${WORKFLOW_LIST_ROW} > span[class~="ml-auto"] { min-width:0; max-width:40%; flex-shrink:1; }
${WORKFLOW_LIST_ROW} > span[class~="ml-auto"] > span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
${DETAIL}[${OPEN}="workflow"] [data-detail-scroll-area] { margin-top:0; padding-top:8px !important; border-top:0; }
${DETAIL}[aria-label="Workflow"][${OPEN}="workflow"] [data-detail-scroll-area] { padding-top:0 !important; }
${DETAIL}[aria-label="Goal"] > [aria-label="Goal controls"] { grid-area:actions; display:flex; align-items:center; justify-content:flex-end; margin-top:0; padding:0 !important; border:0 !important; background:transparent !important; box-shadow:none !important; }
${DETAIL}[aria-label="Goal"] > button[aria-expanded][aria-controls],
${DETAIL}[aria-label="Goal"] > [aria-label="Goal controls"] > button[aria-expanded] { display:none !important; }
${DETAIL}[aria-label="Goal"] > #thread-goal-card-body { grid-area:body; border:0 !important; background:transparent !important; box-shadow:none !important; }
${DETAIL}[aria-label="Goal"] > #thread-goal-card-body > div { background:transparent !important; box-shadow:none !important; }
${DETAIL}[aria-label="Goal"] #thread-goal-card-body > div > div > div[class~="text-muted-foreground"],
${DETAIL}[${MARK}-kind="goal"] [${cardSlot.body}] > p[class~="text-subtle-foreground"],
${DETAIL}[${MARK}-kind="queue"] [${cardSlot.body}] > p[class~="text-subtle-foreground"] { ${cardStyle.meta} }
${DETAIL}[aria-label="Goal"] [aria-label="Clear active Goal"] { grid-area:actions; width:auto; }
${DETAIL}[aria-label="Goal"] [aria-label="Clear active Goal"] > :is(svg, [data-icon-root]) { display:none !important; }
${DETAIL}[aria-label="Prompt mode"] [aria-label="Exit plan mode"] { width:auto; }
${DETAIL}[aria-label="Prompt mode"] [aria-label="Exit plan mode"] > :is(svg, [data-icon-root]) { display:none !important; }
${DETAIL}[aria-label="Model fallback"] [role="status"] > :is(svg, [data-icon-root]),
${DETAIL}[aria-label="Model fallback"] [role="status"] > span:not([title]) { display:none !important; }
${DETAIL}[aria-label="Model fallback"] [aria-label="Dismiss model fallback"] { width:auto; }
${DETAIL}[aria-label="Model fallback"][${cardSlot.layout}="with-actions"] > [role="status"] { display:contents !important; }
${DETAIL}[aria-label="Model fallback"][${cardSlot.layout}="with-actions"] > [role="status"] > span[title] { grid-area:body; min-width:0; overflow-wrap:anywhere; }
${DETAIL}[aria-label="Model fallback"] [aria-label="Dismiss model fallback"] > :is(svg, [data-icon-root]) { display:none !important; }
${DETAIL}[${OPEN}="pullRequest"] a[aria-label^="Pull request "] { padding:4px 8px !important; min-width:0; }
${DETAIL}[${OPEN}="pullRequest"] [${MARK}-pr-heading] { display:flex; align-items:center; gap:var(--bb-chat-ui-card-gap); min-width:0; }
${DETAIL}[${OPEN}="pullRequest"] [${MARK}-pr-title] { ${cardStyle.title} font-weight:400; }
/* Center a 14px mask in its 24px target, but align its visible edge to the 16px Parent icon slot. */
${DETAIL}[${OPEN}="pullRequest"] [${MARK}-pr-heading] a[aria-label^="Pull request "] { ${cardStyle.action} margin-left:var(--bb-chat-ui-card-pr-offset); margin-right:var(--bb-chat-ui-card-pr-trailing); font-size:0 !important; text-decoration:none; }
${DETAIL}[${OPEN}="pullRequest"] [${MARK}-pr-heading] a[aria-label^="Pull request "] > * { display:none !important; }
${DETAIL}[${OPEN}="pullRequest"] [${MARK}-pr-heading] a[aria-label^="Pull request "]::after { content:""; width:var(--bb-chat-ui-card-glyph); height:var(--bb-chat-ui-card-glyph); background:currentColor; mask:${GITHUB_MARK} center/contain no-repeat; -webkit-mask:${GITHUB_MARK} center/contain no-repeat; }
${DETAIL}[${OPEN}="pullRequest"] a[aria-label^="Pull request "] > span[title] { display:none; }
${DETAIL}[aria-label="Thread context before sending"][${OPEN}="pullRequest"] div.inline-flex.overflow-hidden.rounded[class~="border"] { ${cardStyle.button} position:relative; z-index:1; gap:0; padding:0 22px 0 0 !important; border:0 !important; border-radius:0 !important; cursor:default; }
${LARGE_HIT_TARGET} ${DETAIL}[aria-label="Thread context before sending"][${OPEN}="pullRequest"] div.inline-flex.overflow-hidden.rounded[class~="border"] { height:var(--bb-chat-ui-card-button-large); min-height:var(--bb-chat-ui-card-button-large); }
${DETAIL}[${OPEN}="pullRequest"] div.inline-flex.overflow-hidden.rounded[class~="border"] > button { display:inline-flex; align-items:center; justify-content:center; height:20px; min-height:20px; padding:0 !important; ${cardStyle.text} background:transparent !important; border:0 !important; border-radius:0; box-shadow:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }
${DETAIL}[${OPEN}="pullRequest"] div.inline-flex.overflow-hidden.rounded[class~="border"] > button:first-child { pointer-events:none; }
${DETAIL}[${OPEN}="pullRequest"] div.inline-flex.overflow-hidden.rounded[class~="border"]:focus-within { outline:1px solid var(--ring); outline-offset:2px; }
${DETAIL}[${OPEN}="pullRequest"] div.inline-flex.overflow-hidden.rounded[class~="border"] > button[aria-label="Choose pull request merge method"] { position:absolute; inset:0; display:inline-flex; align-items:center; justify-content:flex-end; width:100%; min-width:0; height:100%; min-height:0; margin:0; padding:0 !important; color:var(--foreground); cursor:pointer; }
${DETAIL}[${OPEN}="pullRequest"] button[aria-label="Choose pull request merge method"] svg { display:block; width:14px; height:14px; opacity:1; }
[data-bb-chat-ui-pr-menu-layer] { z-index:56 !important; }
[data-bb-chat-ui-pr-menu-backdrop] { z-index:55 !important; }
${cardFaceCss("[data-bb-chat-ui-pr-menu]")}
${nativeActionMenuCss('[data-bb-chat-ui-pr-menu][role="menu"], [data-bb-chat-ui-pr-menu][data-persistent-drawer-content] > div[class~="overflow-y-auto"]', '[data-bb-chat-ui-pr-menu][role="menu"] > div[role="menuitem"], [data-bb-chat-ui-pr-menu][data-persistent-drawer-content] > div[class~="overflow-y-auto"] > button[role="menuitem"]')}
/* Match the native drawer's 1px border inset without adding another border to the frost face. */
[data-bb-chat-ui-pr-menu][data-persistent-drawer-content] { padding:1px !important; padding-bottom:calc(1px + var(--bb-safe-area-bottom,env(safe-area-inset-bottom,0px))) !important; }
${DETAIL} [class~="bg-surface-raised-solid"]${PROTECTED_EXCLUDE}:not(button[aria-label^="Queued message"][aria-label$=" actions"]) { background-color:transparent !important; box-shadow:none !important; border-color:transparent !important; }
${DETAIL}[${OPEN}="other"] [class~="bg-popover"]${PROTECTED_EXCLUDE} { background-color:transparent !important; box-shadow:none !important; border-width:0 !important; border-color:transparent !important; }
${DETAIL}[${OPEN}="other"] :is(div[class~="px-3"],p[class~="px-3"],ul[class~="px-3"],ul[class~="px-2.5"])${PROTECTED_EXCLUDE} { padding-left:0 !important; padding-right:0 !important; }
${DETAIL} p${PROTECTED_EXCLUDE} { min-width:0; overflow-wrap:anywhere; }
${DETAIL}[${OPEN}="background"] [aria-label^="Background command:"] > span[class~="flex-1"] > span[class~="whitespace-nowrap"]:not([class~="tabular-nums"]) { min-width:0; flex-shrink:1; overflow:hidden; text-overflow:ellipsis; }
${DETAIL}[${OPEN}="background"] [class~="tabular-nums"] { ${cardStyle.secondaryText} }
/* One glass face. Header disclosure sits flat on it; small actions keep the shared face. */
/* The popup owns its entrance; native outer bodies open without another height reveal. */
${DETAIL} > section[role="region"], ${DETAIL}.agentation-staging-shell > .grid { transition:none !important; grid-template-rows:1fr !important; opacity:1 !important; }
${DETAIL} > section[role="region"] { border-top-width:0 !important; border-top-color:transparent !important; background:transparent !important; box-shadow:none !important; }
${DETAIL} > section[role="region"] > div[class~="bg-popover"] { background-color:transparent !important; box-shadow:none !important; }
${DETAIL} ${LEGACY_ROW} { background-color:transparent !important; box-shadow:none !important; backdrop-filter:none !important; -webkit-backdrop-filter:none !important; }
${LIST_ROW} { ${cardStyle.rowBox} margin-top:0 !important; margin-bottom:0 !important; cursor:default; }
${LIST_ROW.split(", ").map(selector => `${selector}:hover`).join(", ")} { ${cardStyle.rowHover} }
${BACKGROUND_SINGLE_ROW} { ${cardStyle.rowBox} ${cardStyle.rowGutter} }
${BACKGROUND_SINGLE_ROW}:is(:hover, :focus-visible) { ${cardStyle.rowHover} }
/* Match the background activity's row rhythm; native space-y margins must not stack with the gap. */
${DETAIL}[${OPEN}="todos"] ul { display:flex; flex-direction:column; row-gap:var(--bb-chat-ui-info-row-gap); }
${DETAIL}[${OPEN}="todos"] li { min-width:0; overflow-wrap:anywhere; }
${DETAIL}[${OPEN}="background"] #thread-background-commands-card-body > div > div[class~="flex-col"],
${DETAIL}[${OPEN}="workflow"] section[role="region"] [class~="flex-col"][class~="gap-1.5"],
${DETAIL}[${OPEN}="workflow"] section[role="region"] button[aria-expanded] + [class~="flex-col"] { row-gap:var(--bb-chat-ui-info-row-gap); }
${DETAIL}[${OPEN}="workflow"] section[role="region"] button[aria-expanded] + [class~="flex-col"] { margin-top:var(--bb-chat-ui-info-row-gap) !important; }
/* Leave the corner gutter inside the real scroller, not outside a clipped reveal wrapper. */
${LIST_DETAIL} > section[role="region"], ${LIST_DETAIL} > section[role="region"] > div[class~="bg-popover"] { min-width:0; overflow:visible !important; }
${LIST_DETAIL} [data-detail-scroll-area] { box-sizing:border-box; width:calc(100% + 2 * var(--bb-chat-ui-card-row-pad)); margin-left:calc(-1 * var(--bb-chat-ui-card-row-pad)); margin-right:calc(-1 * var(--bb-chat-ui-card-row-pad)); padding-left:var(--bb-chat-ui-card-row-pad) !important; padding-right:var(--bb-chat-ui-card-row-pad) !important; }
${NATIVE_BODY} { ${cardStyle.body} }
${DETAIL}[${OPEN}="queue"] [data-queued-messages-scroll] > ul[data-bb-chat-ui-queue-end-boundary="true"] { padding-top:0 !important; }
/* Main popovers own the common height cap; native list caps must not shorten it. */
${DETAIL}[${OPEN}="todos"] ul, ${DETAIL}[aria-label="Child threads"] ul, ${DETAIL} [data-detail-scroll-area] { max-height:none !important; overflow:visible !important; }
${DETAIL}[${OPEN}="workflow"] section[aria-label="Workflow"] { overflow:visible !important; background-color:transparent !important; border:0 !important; box-shadow:none !important; }
${DETAIL}[${OPEN}="workflow"] section[role="region"]:not([aria-hidden="true"]) { overflow:visible !important; border-top-width:0 !important; border-top-color:transparent !important; background:transparent !important; box-shadow:none !important; }
${DETAIL}[${OPEN}="workflow"] section[role="region"]:not([aria-hidden="true"]) > div[class~="bg-popover"] { overflow:visible !important; background-color:transparent !important; box-shadow:none !important; }
${WORKFLOW_LIST_ROW} { width:calc(100% + 2 * var(--bb-chat-ui-card-row-pad)); margin-left:calc(-1 * var(--bb-chat-ui-card-row-pad)); margin-right:calc(-1 * var(--bb-chat-ui-card-row-pad)); min-height:var(--bb-chat-ui-card-workflow-min) !important; padding:var(--bb-chat-ui-card-workflow-y) var(--bb-chat-ui-card-row-pad) !important; }
/* A compact step timeline; native phase controls and agent nodes retain their parents. */
${WORKFLOW_PHASES} > div { position:relative; min-width:0; }
${WORKFLOW_PHASE_ROW} { gap:var(--bb-chat-ui-card-gap); opacity:1; }
${WORKFLOW_PHASE_ROW.split(", ").map(selector => `${selector}::before`).join(", ")} { content:""; position:relative; z-index:1; display:inline-block; flex:none; width:var(--bb-chat-ui-card-workflow-dotbox); height:var(--bb-chat-ui-card-workflow-dotbox); border:0; border-radius:999px; background:radial-gradient(circle,var(--subtle-foreground) 0 4px,transparent 4.5px); }
${WORKFLOW_PHASES} > div:not(:last-child)::after { content:""; position:absolute; top:var(--bb-chat-ui-card-workflow-top); bottom:calc(-1 * var(--bb-chat-ui-card-workflow-tail)); left:var(--bb-chat-ui-card-workflow-left); width:2px; background:color-mix(in oklab,var(--foreground) 22%,transparent); pointer-events:none; }
${WORKFLOW_PHASES} > div[class~="items-center"]:not(:last-child)::after { left:calc(var(--bb-chat-ui-card-row-pad) + var(--bb-chat-ui-card-workflow-left)); }
${WORKFLOW_PHASES} > div > button[aria-expanded] > svg { order:3; margin-left:auto; flex:none; color:var(--subtle-foreground); }
${WORKFLOW_PHASES} > div > button[aria-expanded] > span[class~="font-medium"] { flex:1; }
${WORKFLOW_PHASES} > div[class~="items-center"] > span[aria-hidden="true"] { display:none; }
${WORKFLOW_PHASE_ROW.split(", ").map(selector => `${selector} > span[class~="tabular-nums"]`).join(", ")} { ${cardStyle.secondaryText} }
${WORKFLOW_PHASES} > div[class~="items-center"] > span[class~="tabular-nums"] { margin-left:auto; white-space:nowrap; }`;
const composerInfoWorkflowCss = `
${WORKFLOW_PHASES} > div > button[aria-expanded][class~="bg-background/70"]::before,
${WORKFLOW_PHASES} > div > button[aria-expanded]:has(> [data-icon="CircleCheck"])::before,
${WORKFLOW_PHASES} > div[class~="items-center"][class~="bg-background/70"]::before,
${WORKFLOW_PHASES} > div[class~="items-center"]:has(> [data-icon="CircleCheck"])::before { background:radial-gradient(circle,var(--foreground) 0 4px,transparent 4.5px); }
${WORKFLOW_PHASES} > div > button[aria-expanded] + div[class~="flex-col"] { margin-left:var(--bb-chat-ui-card-workflow-center) !important; padding-left:var(--bb-chat-ui-card-workflow-dotbox); border-left:0; }
${WORKFLOW_AGENT_ROW} { display:grid; grid-template-columns:14px minmax(0,1fr); column-gap:var(--bb-chat-ui-card-gap); row-gap:2px; }
${WORKFLOW_AGENT_ROW} > svg[data-icon-root] { grid-column:1; grid-row:1; align-self:center; }
${WORKFLOW_AGENT_ROW} > span[class~="truncate"] { grid-column:2; grid-row:1; font-weight:400; }
${WORKFLOW_AGENT_ROW} > span[class~="ml-auto"] { grid-column:2; grid-row:2; justify-self:start; max-width:100%; width:100%; margin-left:0; }`;
const composerInfoSuffix = `
${DETAIL} :is([${MARK}-close-heading], [${MARK}-close-heading] button[aria-expanded]):is(:hover, :focus-visible) { background-color:transparent !important; }
${DETAIL}[${OPEN}="background"] #thread-background-commands-card-body > div > div > div[class~="px-3"] { width:calc(100% + 2 * var(--bb-chat-ui-card-row-pad)); margin:0 calc(-1 * var(--bb-chat-ui-card-row-pad)); }
[${MARK}-activity-panel] { display:flex; flex-direction:column; gap:2px; margin:0; padding:0 8px 0 20px; color:var(--subtle-foreground); ${cardStyle.prose} }
[${MARK}-trigger]:hover, [${MARK}-stack-kind]:hover, [${MARK}-all]:hover { transform:translateY(-1px); }
[${MARK}-trigger]:active, [${MARK}-stack-kind]:active, [${MARK}-all]:active { transform:scale(.95); }
[${MARK}-trigger][aria-expanded=true], [${MARK}-stack-kind][aria-expanded=true], [${MARK}-all][aria-expanded=true] { box-shadow:0 6px 18px -12px var(--bb-chat-ui-info-shadow),inset 0 1px 3px var(--bb-chat-ui-info-edge),inset 0 0 0 1px var(--border); }
[${MARK}-trigger][hidden] { display:none; }
[${MARK}-trigger][${MARK}-unavailable] { width:32px; min-height:32px; padding:0; border-radius:50%; color:var(--subtle-foreground); }
[${MARK}-trigger] > span:not([${MARK}-avatars]) { overflow:hidden; text-overflow:ellipsis; }
[${MARK}-trigger] svg { width:16px; height:16px; flex-shrink:0; }
[${MARK}-trigger] > [data-icon-root], [${MARK}-choice] > [data-icon-root] { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex-shrink:0; }
[${MARK}-diff-summary], [${MARK}-commit-count] { display:inline-flex; align-items:center; min-width:0; }
[${MARK}-commit-count] { flex-shrink:0; gap:4px; white-space:nowrap; }
[${MARK}-commit-count] svg { width:14px; height:14px; }
[${MARK}-trigger] [data-bb-chat-ui-branch] { display:inline-flex; flex-shrink:0; color:var(--color-purple-500,#a855f7); }
[${MARK}-diff-content] [${MARK}-diff-branch] { display:flex; align-items:center; gap:6px; color:var(--color-purple-500,#a855f7); }
[${MARK}-diff-branch] code { min-width:0; overflow-wrap:anywhere; white-space:normal; }
[${MARK}-diff-branch] svg, [${MARK}-diff-branch] [data-icon-root] { width:16px; height:16px; flex-shrink:0; }
[${MARK}-trigger="diff"] { min-width:0; }
[${MARK}-trigger="diff"][${MARK}-resizing] { overflow:hidden; }
[${MARK}-diff-loading] { display:inline-flex; justify-content:center; width:20px; gap:2px; transform:translateY(-2px); }
[${MARK}-diff-loading] span { animation:bb-info-loading 900ms ease-in-out infinite; }
[${MARK}-diff-loading] span:nth-child(2) { animation-delay:120ms; }
[${MARK}-diff-loading] span:nth-child(3) { animation-delay:240ms; }
[${MARK}-trigger="diff"] [${MARK}-diff-number] { display:inline-block; position:relative; height:18px; line-height:18px; overflow:hidden; vertical-align:bottom; font-variant-numeric:tabular-nums; }
[${MARK}-diff-current] { display:block; animation:bb-info-count-in 180ms cubic-bezier(.2,.8,.2,1); }
[${MARK}-diff-previous] { position:absolute; inset:0; pointer-events:none; animation:bb-info-count-out 180ms cubic-bezier(.2,.8,.2,1) forwards; }
[${MARK}-diff-previous]::before { content:attr(${MARK}-diff-value); }
body > .bbk-drop { z-index:54; --bbk-drop-face:${LIGHT_GLASS_FACE}; --bbk-drop-edge:color-mix(in oklab,var(--popover) 35%,transparent); }
.dark body > .bbk-drop, body.dark > .bbk-drop { --bbk-drop-face:${DARK_GLASS_FACE}; --bbk-drop-edge:color-mix(in oklab,var(--foreground) 8%,transparent); }
[${MARK}-all] { position:relative; width:32px; padding:0; }
[${MARK}-glyph] { display:block; width:16px; height:16px; pointer-events:none; color:var(--subtle-foreground); transition:opacity 200ms, scale 280ms cubic-bezier(.2,.9,.22,1.25); }
[${MARK}-stack-kind]:hover, [${MARK}-all]:hover [${MARK}-glyph], [${MARK}-all][aria-expanded=true] [${MARK}-glyph] { color:var(--foreground); }
[${MARK}-count] { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:600; opacity:0; scale:.6; pointer-events:none; transition:opacity 200ms, scale 280ms cubic-bezier(.2,.9,.22,1.25); }
[${MARK}-stack-icons] { position:relative; display:flex; flex:none; align-items:center; width:auto; min-width:0; isolation:isolate; }
[${MARK}-stack-icons][hidden] { display:none; }
[${MARK}-stack-kind], [${MARK}-stack-icons] > [${MARK}-all] { position:relative; flex:none; width:32px; height:32px; padding:0; margin-left:-14px; border-radius:999px; box-shadow:0 0 0 2px var(--bb-chat-ui-glass-base,var(--background)),inset 0 1px 3px var(--bb-chat-ui-info-edge); }
[${MARK}-stack-kind]:first-child, [${MARK}-stack-icons] > [${MARK}-all]:first-child { margin-left:0; }
[${MARK}-stack-kind] svg, [${MARK}-stack-kind] [data-icon-root] { width:16px; height:16px; flex:none; color:var(--subtle-foreground); }
[${MARK}-stack-kind] > [data-icon-root] { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
[${MARK}-stack-kind][${MARK}-active] svg { color:var(--foreground); }
[${MARK}-stack-icons] > [${MARK}-all] [${MARK}-glyph] { display:none; }
[${MARK}-stack-icons] > [${MARK}-all] [${MARK}-count] { opacity:1; scale:1; }
[${MARK}-stack-kind][${MARK}-active]::after, [${MARK}-all][${MARK}-active]::after { content:""; position:absolute; left:0; bottom:0; width:6px; height:6px; border-radius:50%; background:var(--success-text,var(--foreground)); box-shadow:0 0 0 2px var(--bb-chat-ui-glass-base,var(--background)); pointer-events:none; }
[${MARK}-jump] { display:inline-flex; flex:none; align-items:center; justify-content:center; gap:5px; padding:0; border:0; border-radius:999px; font-size:12px !important; line-height:18px; white-space:nowrap; color:var(--foreground); cursor:pointer; }
[${MARK}-jump] svg { width:16px; height:16px; flex-shrink:0; transition:scale 420ms cubic-bezier(.22,1,.36,1); }
[${MARK}-jump][${MARK}-jump-off] { visibility:hidden; opacity:0; pointer-events:none; }
[${MARK}-bar][${MARK}-layout="dock"] > [${MARK}-jump] { position:absolute; right:0; top:0; z-index:2; width:32px; height:32px; transition:opacity 280ms ease-out, translate 460ms cubic-bezier(.22,1,.36,1), scale 460ms cubic-bezier(.22,1,.36,1), visibility 0s; }
[${MARK}-bar][${MARK}-layout="dock"] > [${MARK}-jump][${MARK}-jump-off] { translate:0 10px; scale:.92; transition:opacity 220ms ease-in, translate 340ms cubic-bezier(.4,0,.2,1), scale 340ms cubic-bezier(.4,0,.2,1), visibility 0s 340ms; }
[${MARK}-bar][${MARK}-layout="dock"] [${MARK}-jump-label] { display:none; }
[${MARK}-jump]:focus-visible { outline:2px solid var(--ring); outline-offset:3px; }
[data-bb-chat-ui-info-jump-source] { visibility:hidden !important; pointer-events:none !important; }
/* Avatars frost only on the bar; inside a card they sit on its face. */
[${MARK}-trigger] [${MARK}-avatar] { backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); }
[${MARK}-trigger="children"]:not([${MARK}-unavailable]) { padding:0; min-height:34px; border:0 !important; border-radius:0; background:transparent !important; backdrop-filter:none; -webkit-backdrop-filter:none; box-shadow:none !important; }
[${MARK}-trigger="children"]:not([${MARK}-unavailable]):hover { transform:none; }
[${MARK}-avatars] { display:flex; align-items:center; isolation:isolate; }
[${MARK}-avatar], [${MARK}-avatar-more] { position:relative; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; width:30px; height:30px; margin-left:-12px; border-radius:50%; background:var(--bb-chat-ui-info-face); box-shadow:0 0 0 2px var(--bb-chat-ui-glass-base,var(--background)),inset 0 1px 3px var(--bb-chat-ui-info-edge); font-size:10px; font-weight:600; line-height:1; transition:transform 400ms cubic-bezier(.2,.9,.22,1.25); }
[${MARK}-avatar]:first-child { margin-left:0; }
[${MARK}-avatar]:nth-child(3n+1) { background:color-mix(in oklch,var(--bb-chat-ui-info-face) 76%,oklch(.75 .13 250) 24%); }
[${MARK}-avatar]:nth-child(3n+2) { background:color-mix(in oklch,var(--bb-chat-ui-info-face) 78%,oklch(.75 .1 155) 22%); }
[${MARK}-avatar]:nth-child(3n) { background:color-mix(in oklch,var(--bb-chat-ui-info-face) 78%,oklch(.78 .09 60) 22%); }
[${MARK}-trigger="children"]:hover [${MARK}-avatar], [${MARK}-trigger="children"]:hover [${MARK}-avatar-more] { transform:translateY(-2px); }
[${MARK}-avatar-more] { color:var(--subtle-foreground); backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); }
[${MARK}-avatar-dot] { position:absolute; left:0; right:auto; bottom:0; width:6px; height:6px; border-radius:50%; background:var(--success-text,#80b995); box-shadow:0 0 0 2px var(--bb-chat-ui-glass-base,var(--background)); }
[${MARK}-avatar][data-state="run"] [${MARK}-avatar-dot] { animation:bb-info-breathe 2.6s ease-in-out infinite; }
[${MARK}-avatar][data-state="wait"] [${MARK}-avatar-dot] { background:var(--warning-text,#cfb577); }
[${MARK}-avatar][data-state="error"] [${MARK}-avatar-dot] { background:var(--destructive-text,#d99090); }
[${MARK}-avatar][data-state="done"] [${MARK}-avatar-dot] { background:var(--subtle-foreground); }
[${MARK}-avatar][data-state="done"][data-unread="true"] [${MARK}-avatar-dot] { background:var(--timeline-accent); }
[${MARK}-avatar] [${MARK}-provider-icon], [${MARK}-avatar] [${MARK}-provider-icon] > :is(svg, span, img) { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex-shrink:0; }
[${MARK}-avatar][data-new] { animation:bb-info-droplet 460ms cubic-bezier(.36,0,.18,1) backwards; }
[${MARK}-menu], ${DETAIL} { position:absolute !important; display:block !important; left:0 !important; right:0 !important; top:auto !important; bottom:40px !important; transform:none !important; box-sizing:border-box; width:100% !important; max-width:none !important; min-height:0 !important; height:auto !important; max-height:var(--bb-chat-ui-info-max-height) !important; overflow:auto !important; margin:0 !important; order:0 !important; z-index:52; transform-origin:center bottom; animation:bb-info-enter 260ms cubic-bezier(.22,1,.36,1); }
/* Keep native actions on their original parents while sharing one title row. */
${DETAIL}[aria-label="Goal"]:not([${MARK}-kind]) { display:grid !important; grid-template-columns:minmax(0,1fr) auto var(--bb-chat-ui-card-icon); grid-template-areas:"heading actions close" "body body body"; grid-template-rows:var(--bb-chat-ui-card-head) auto; align-items:center; gap:var(--bb-chat-ui-card-gap); outline:0 !important; }
${DETAIL}[aria-label="Goal"]:not([${MARK}-kind]) > * { min-width:0; flex-shrink:0; }
${DETAIL}[aria-label="Goal"]:not([${MARK}-kind]) > h3[${MARK}-close-heading] { grid-area:heading; margin:0; padding-right:0 !important; }
[${MARK}-menu], ${DETAIL} { overscroll-behavior:contain !important; }
[${MARK}-menu] > p { margin:0 0 var(--bb-chat-ui-card-gap); }
/* The catalog is a list of rows laid out in columns: the grid owns the hover gutter. */
[${MARK}-menu] > [${MARK}-catalog] { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr)); gap:2px; ${cardStyle.rowGutter} }
[${MARK}-choice] { display:flex; min-width:0; align-items:center; gap:var(--bb-chat-ui-card-gap); color:inherit; font:inherit; text-align:left; cursor:pointer; ${cardStyle.rowBox} }
[${MARK}-choice]:is(:hover, :focus-visible) { ${cardStyle.rowHover} }
[${MARK}-choice] span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[${MARK}-choice] svg { width:16px; height:16px; flex-shrink:0; }
[${MARK}-choice][${MARK}-unavailable] { color:var(--subtle-foreground); }
[${MARK}-choice] small { margin-left:auto; flex-shrink:0; ${cardStyle.meta} }
[${MARK}-scroll-hint] { position:absolute; pointer-events:none; z-index:53; backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
[${MARK}-scroll-hint][hidden] { display:none; }
[${MARK}-scroll-hint="top"] { border-radius:18px 18px 0 0; background:linear-gradient(to bottom,var(--bb-chat-ui-info-face),transparent); mask-image:linear-gradient(to bottom,black,transparent); -webkit-mask-image:linear-gradient(to bottom,black,transparent); }
[${MARK}-scroll-hint="bottom"] { border-radius:0 0 18px 18px; background:linear-gradient(to top,var(--bb-chat-ui-info-face),transparent); mask-image:linear-gradient(to top,black,transparent); -webkit-mask-image:linear-gradient(to top,black,transparent); }
[${MARK}-diff] p { white-space:pre-wrap; }
[${MARK}-diff-content] { display:block !important; }
[${MARK}-diff-files], [${MARK}-diff-commits] { display:flex; flex-direction:column; row-gap:0; }
[${MARK}-diff-file], [${MARK}-diff-commit] { display:flex; align-items:center; gap:var(--bb-chat-ui-card-gap); min-width:0; ${cardStyle.rowBox} ${cardStyle.rowGutter} }
[${MARK}-diff-file]:hover, [${MARK}-diff-commit]:hover { ${cardStyle.rowHover} }
[${MARK}-diff-file][hidden], [${MARK}-diff-commit][hidden] { display:none !important; }
[${MARK}-diff-toggle] { display:flex; align-items:center; gap:6px; margin:0; color:var(--subtle-foreground); font-family:inherit; cursor:pointer; text-align:left; ${cardStyle.rowBox} ${cardStyle.rowGutter} }
[${MARK}-diff] [${MARK}-diff-toggle]:is(:hover, :focus-visible) { ${cardStyle.rowHover} }
[${MARK}-diff-toggle]:focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
[${MARK}-diff-toggle] svg { width:12px; height:12px; flex-shrink:0; }
[${MARK}-diff-toggle][aria-expanded=true] svg { transform:rotate(180deg); }
[${MARK}-diff-file] > svg { width:16px; height:16px; flex-shrink:0; }
[${MARK}-diff-graph] { position:relative; align-self:stretch; margin-top:calc(-1 * var(--bb-chat-ui-card-row-pad)); margin-bottom:calc(-1 * var(--bb-chat-ui-card-row-pad)); width:16px; flex-shrink:0; color:var(--subtle-foreground); }
[${MARK}-diff-graph]::before, [${MARK}-diff-graph]::after { content:""; position:absolute; left:7.5px; width:1px; background:color-mix(in oklab,var(--subtle-foreground) 40%,transparent); }
[${MARK}-diff-graph]::before { top:0; bottom:calc(50% + 4px); }
[${MARK}-diff-graph]::after { top:calc(50% + 4px); bottom:0; }
[${MARK}-diff-commit]:first-child [${MARK}-diff-graph]::before, [${MARK}-diff-commit]:last-child [${MARK}-diff-graph]::after { display:none; }
[${MARK}-diff-commits][${MARK}-diff-collapsed] > [${MARK}-diff-commit]:nth-child(5) [${MARK}-diff-graph]::after { display:none; }
[${MARK}-diff-graph] svg { position:absolute; width:12px; height:12px; left:2px; top:calc(50% - 6px); fill:none; stroke:currentColor; stroke-width:1.5; }
[${MARK}-diff-file] code, [${MARK}-diff-commit] code { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-family:var(--font-mono,monospace); ${cardStyle.secondaryText} }
[${MARK}-diff-file] > span { flex-shrink:0; ${cardStyle.secondaryText} }
[${MARK}-diff-content] h4 { ${cardStyle.meta} margin:12px 0 4px; }
[${MARK}-diff-content] > hr { margin:10px 0; border:0; border-top:1px solid color-mix(in oklab,var(--border-seam,var(--border)) 55%,transparent); }
[${MARK}-diff-meta] { display:flex; flex-wrap:wrap; align-items:center; gap:4px; font-size:var(--bb-chat-ui-card-secondary-size) !important; line-height:var(--bb-chat-ui-card-meta-line); color:var(--subtle-foreground); }
[${MARK}-diff-meta] code { font:inherit; overflow-wrap:anywhere; }
${DETAIL}[aria-label="Queued messages"] { display:flex !important; flex-direction:column; max-height:var(--bb-chat-ui-info-max-height) !important; overflow:hidden !important; gap:0 !important; }
${DETAIL}[aria-label="Queued messages"] > :not([${cardSlot.head}]) { min-height:0; }
${DETAIL}[aria-label="Queued messages"] > [${MARK}-close-heading] { flex:none; margin-bottom:var(--bb-chat-ui-card-gap); }
${DETAIL} [data-queued-messages-scroll-frame] { position:static !important; display:grid !important; grid-template-rows:minmax(0,1fr); flex:0 1 auto !important; width:100% !important; height:auto !important; min-height:0 !important; max-height:none !important; overflow:hidden !important; }
${DETAIL} [data-queued-messages-scroll] { height:auto !important; min-height:0 !important; max-height:none !important; padding:4px 0; overflow-y:auto !important; overflow-x:hidden !important; overscroll-behavior:contain; }
${DETAIL} header[data-queued-messages-mode] { display:none !important; }
${DETAIL}[aria-label="Queued messages"] > [${MARK}-queue-collapse-wrap] { display:none !important; }
${STACK}[${MARK}-request] [${UNIT}][${UNIT}], [${MARK}-request] [${MARK}-menu] { display:none !important; }
[${MARK}-stack] :is(${QUESTION}) { border-radius:18px !important; overflow:hidden; transform-origin:center bottom; animation:bb-info-enter 260ms cubic-bezier(.22,1,.36,1); }
[${MARK}-stack] :is([data-testid="plan-review-banner"], [data-testid="approval-banner"]) { border-radius:18px !important; overflow:hidden; }
[${MARK}-stack] [data-testid="plugin-request-banner"] > [data-testid="plugin-interaction-shell"] { border-radius:18px !important; overflow:hidden; }
/* Native envelopes are a 6% recessed wash with no blur. Frost the visible card once.
   The plugin-request wrapper only carries the entrance, so a second blur there would stack. */
[${MARK}-stack] :is([data-testid="tool-use-ask"], [data-testid="user-question-banner"], [data-testid="approval-banner"], [data-testid="plan-review-banner"]),
[${MARK}-stack] [data-testid="plugin-request-banner"] > [data-testid="plugin-interaction-shell"] { background:var(--bb-chat-ui-info-face) !important; border-color:transparent !important; backdrop-filter:blur(14px) saturate(1.25); -webkit-backdrop-filter:blur(14px) saturate(1.25); box-shadow:0 12px 32px -14px var(--bb-chat-ui-info-shadow),inset 0 1px 3px var(--bb-chat-ui-info-edge) !important; }
/* A collapsed secret shell keeps mb-2, and the grid keeps space-y margin under the hidden composer. */
[data-promptbox-shell][${MARK}-collapsed-interaction] > .grid,
[${MARK}-stack] [data-testid="plugin-interaction-shell"]:not([data-expanded]) { margin-bottom:0 !important; }
[${MARK}-stack] [data-testid="plugin-interaction-shell"]:not([data-expanded]) > :first-child span { align-items:center; }
[${MARK}-stack] [data-testid="plugin-interaction-shell"] form > .sticky { background:transparent !important; border-top:0 !important; box-shadow:none !important; }
/* Expanded secret header hairline is the 1px line on the scroll edge. Other request shells keep it. */
[${MARK}-stack] [data-testid="plugin-interaction-shell"][${MARK}-secret-form] > :first-child { border-bottom-color:transparent !important; }
[${MARK}-stack] [data-testid="plan-review-request"] { position:relative; background:transparent !important; border:0 !important; border-radius:0 !important; overflow:visible !important; box-shadow:none !important; }
[${MARK}-stack] [data-testid="plan-review-request"] > .overflow-auto { padding-left:0 !important; padding-right:0 !important; }
[${MARK}-stack] [data-testid="plan-review-request"] > p { border-top:0 !important; padding-left:0 !important; padding-right:0 !important; }
/* Opaque mix of the lifted surface over the theme base. A second translucent face lightens the edge, and blur(5px) otherwise smears text into that edge. The 8px hold covers the blur kernel; 24px is the fade band. */
[${MARK}-body-fade] { --bb-chat-ui-body-fade-solid:color-mix(in oklch, oklch(from var(--bb-chat-ui-glass-base, var(--background)) min(1, calc(l + 0.075)) c h) 68%, var(--bb-chat-ui-glass-base, var(--background))); position:absolute; pointer-events:none; z-index:4; background:var(--bb-chat-ui-body-fade-solid); backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
.dark [${MARK}-body-fade] { --bb-chat-ui-body-fade-solid:color-mix(in oklch, oklch(from var(--bb-chat-ui-glass-base, var(--background)) min(1, calc(l + 0.075)) c h) 76%, var(--bb-chat-ui-glass-base, var(--background))); }
[${MARK}-body-fade][hidden] { display:none; }
[${MARK}-body-fade="above"] { mask-image:linear-gradient(to bottom,black 0px,black 8px,transparent 24px); -webkit-mask-image:linear-gradient(to bottom,black 0px,black 8px,transparent 24px); }
[${MARK}-body-fade="below"] { mask-image:linear-gradient(to top,black 0px,black 8px,transparent 24px); -webkit-mask-image:linear-gradient(to top,black 0px,black 8px,transparent 24px); }
[data-promptbox-shell]:has(> [${MARK}-request]) [data-follow-up-composer-anchor] { display:none !important; }
[data-scroll-footer]:has([${MARK}-request]) button[aria-label="Scroll to latest event"] { display:none !important; }
[${MARK}-stack] [${MARK}-supplements] { display:contents; }
[${MARK}-kind] { ${cardStyle.text} }
[${MARK}-kind] p { white-space:pre-wrap; margin:6px 0; }
[${MARK}-parent-row] [${MARK}-provider-icon], [${MARK}-parent-row] [${MARK}-provider-icon] > :is(svg, span, img) { display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex-shrink:0; }
[${MARK}-parent-title] { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${cardStyle.titleText} font-weight:400; }
[${MARK}-child-row] [${MARK}-avatar] { width:27px; height:27px; margin-left:0; }
[${MARK}-child-main] { flex:1; min-width:0; }
[${MARK}-child-title] { display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${cardStyle.text} }
[${MARK}-child-meta], [${MARK}-child-status] { ${cardStyle.meta} }
[${MARK}-child-meta] { display:block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
[${MARK}-child-status] { flex:none; white-space:nowrap; }
${DETAIL}[aria-label="Child threads"] ul > li > a { display:flex; align-items:center; gap:var(--bb-chat-ui-card-gap); min-width:0; color:inherit; cursor:pointer; text-decoration:none; ${cardStyle.rowBox} ${cardStyle.rowGutter} }
${DETAIL}[aria-label="Child threads"] ul > li > a:is(:hover, :focus-visible) { ${cardStyle.rowHover} }
/* Agentation: native header pieces join the card's head line; the close is the shared slot. */
${DETAIL}.agentation-staging-shell { display:grid !important; grid-template-columns:minmax(0,1fr) auto var(--bb-chat-ui-card-icon); grid-template-rows:var(--bb-chat-ui-card-head) auto; grid-template-areas:"heading actions close" "body body body"; align-items:center; column-gap:var(--bb-chat-ui-card-gap); row-gap:var(--bb-chat-ui-card-gap); }
${DETAIL}.agentation-staging-shell > div:first-child { display:contents !important; }
${DETAIL}.agentation-staging-shell > div:first-child > div:first-child { display:contents !important; }
${DETAIL}.agentation-staging-shell > div:first-child > div:first-child > [data-icon="ChatFeedback"] { display:none !important; }
${DETAIL}.agentation-staging-shell > div:first-child > div:first-child > p { grid-area:heading; margin:0; padding-right:0 !important; overflow:hidden; white-space:nowrap; }
${DETAIL}.agentation-staging-shell button[aria-label="Collapse staged annotations"] :is(svg, [data-icon-root]) { display:none; }
${DETAIL}.agentation-staging-shell button[aria-label="Collapse staged annotations"]::after { content:""; ${cardStyle.closeIcon} background-color:currentColor; mask-image:${CARD_CLOSE_MASK}; -webkit-mask-image:${CARD_CLOSE_MASK}; mask-size:100% 100%; -webkit-mask-size:100% 100%; mask-repeat:no-repeat; -webkit-mask-repeat:no-repeat; }
${DETAIL}.agentation-staging-shell > div:first-child > div:last-child { grid-area:actions; display:flex; flex-wrap:nowrap; align-items:center; justify-content:flex-end; gap:4px; margin-top:0; }
${DETAIL}.agentation-staging-shell > div:first-child > div:last-child > button:first-child { order:2; }
${DETAIL}.agentation-staging-shell > div:first-child > div:last-child > button:last-child { order:1; }
${DETAIL}.agentation-staging-shell > div:first-child > div:last-child > button:not([${MARK}-bulk-action]) { ${cardStyle.button} }
${LARGE_HIT_TARGET} ${DETAIL}.agentation-staging-shell > div:first-child > div:last-child > button:not([${MARK}-bulk-action]) { height:var(--bb-chat-ui-card-button-large); min-height:var(--bb-chat-ui-card-button-large); }
${DETAIL}.agentation-staging-shell button[${MARK}-bulk-action] { gap:0; font-size:0 !important; }
${DETAIL}.agentation-staging-shell button[${MARK}-bulk-action] > :not([${MARK}-bulk-icon]) { display:none !important; }
[${MARK}-bulk-icon], [${MARK}-bulk-icon] svg { display:inline-flex; width:var(--bb-chat-ui-card-glyph); height:var(--bb-chat-ui-card-glyph); pointer-events:none; }
${DETAIL}.agentation-staging-shell > .grid { grid-area:body; width:100%; }
${DETAIL}.agentation-staging-shell > .grid,
${DETAIL}.agentation-staging-shell > .grid > div { overflow:visible !important; }
${DETAIL}.agentation-staging-shell > .grid > div > div { padding:0 !important; }
${DETAIL}.agentation-staging-shell ul { max-height:none !important; margin:0 !important; padding:0 !important; border:0 !important; overflow:visible !important; }
${DETAIL}.agentation-staging-shell ul { display:flex; flex-direction:column; row-gap:var(--bb-chat-ui-info-row-gap); }
${DETAIL}.agentation-staging-shell li { display:flex !important; align-items:center; gap:var(--bb-chat-ui-card-gap); min-width:0; margin-top:0 !important; margin-bottom:0 !important; ${cardStyle.rowBox} ${cardStyle.rowGutter} }
${DETAIL}.agentation-staging-shell li:is(:hover, :focus-within) { ${cardStyle.rowHover} }
${DETAIL}.agentation-staging-shell li > button { ${cardStyle.action} }
${DETAIL}.agentation-staging-shell li > button :is(svg, [data-icon-root]) { width:var(--bb-chat-ui-card-glyph); height:var(--bb-chat-ui-card-glyph); }
${DETAIL}.agentation-staging-shell li > button:not(:disabled):is(:hover, :focus-visible) { ${cardStyle.hover} }
${DETAIL}.agentation-staging-shell li > span[aria-hidden="true"] { display:grid !important; grid-template-areas:"comment comment" "location target"; grid-template-columns:auto minmax(0,1fr); gap:0 6px; flex:1; min-width:0; }
${DETAIL}.agentation-staging-shell li > span[aria-hidden="true"] > span { max-width:none !important; font:inherit; }
${DETAIL}.agentation-staging-shell li > span[aria-hidden="true"] > span:nth-child(1) { grid-area:location; ${cardStyle.meta} }
${DETAIL}.agentation-staging-shell li > span[aria-hidden="true"] > span:nth-child(2) { grid-area:target; ${cardStyle.meta} }
${DETAIL}.agentation-staging-shell li > span[aria-hidden="true"] > span:nth-child(3) { display:none; }
${DETAIL}.agentation-staging-shell li > span[aria-hidden="true"] > span:nth-child(4) { grid-area:comment; ${cardStyle.prose} font-weight:400; white-space:normal; overflow-wrap:anywhere; }
${DETAIL}.agentation-staging-shell li::before { content:""; flex-shrink:0; width:14px; height:14px; background:var(--subtle-foreground); mask:var(--bb-chat-ui-feedback-icon) center/contain no-repeat; }
@keyframes bb-info-enter { from { opacity:0; translate:0 8px; scale:.98; } to { opacity:1; translate:0 0; scale:1; } }
@keyframes bb-info-droplet { 0% { transform:translateY(8px) scale(.82,.72); } 35% { transform:translateY(-4px) scale(.94,1.16); } 65% { transform:translateY(0) scale(1.1,.94); } 82% { transform:translateY(-1px) scale(.985,1.015); } 100% { transform:none; } }
@keyframes bb-info-breathe { 50% { opacity:.4; } }
@keyframes bb-info-loading { 0%,80%,100% { opacity:.35; transform:none; } 40% { opacity:1; transform:translateY(-2px); } }
@keyframes bb-info-count-in { from { translate:0 100%; opacity:0; } to { translate:0 0; opacity:1; } }
@keyframes bb-info-count-out { from { translate:0 0; opacity:1; } to { translate:0 -100%; opacity:0; } }
${STACK}[${MARK}-stack]:not(:has([${SOURCE}])) [${UNIT}][${OPEN}]:not([hidden]) { display:none !important; }
@media (prefers-reduced-motion:reduce) { [${MARK}-bar] *, [${MARK}-stack] [${UNIT}][${OPEN}] { animation:none !important; transition:none !important; } }
@media (prefers-reduced-motion:reduce) { [${MARK}-stack] :is(${QUESTION}) { animation:none !important; transition:none !important; } }
@media (prefers-reduced-motion:reduce) { [${MARK}-diff-previous] { display:none; } }
`;
export const composerInfoCss = composerInfoPrefix + composerInfoWorkflowCss + composerInfoSuffix;

interface InfoItem { key: InfoKind; node: HTMLElement; trigger: HTMLElement | null; label: string; }
function kindsOf(node: HTMLElement): InfoKind[] {
  const explicit = node.getAttribute(`${MARK}-kind`) as InfoKind | null;
  if (explicit && infoKinds.some(kind => kind.key === explicit)) return [explicit];
  if (node.matches(".agentation-staging-shell")) return ["annotations"];
  const label = node.getAttribute("aria-label") ?? "";
  if (label === "Child threads") return ["children"];
  if (label === "Thread context before sending") {
    const kinds: InfoKind[] = [];
    if (node.querySelector('#thread-prompt-banner-git-toggle')) kinds.push("diff");
    if (node.querySelector('[aria-label^="Pull request "]')) kinds.push("pullRequest");
    if (node.querySelector('#thread-prompt-banner-parent-thread-toggle, a[href*="/threads/"]')) kinds.push("parent");
    return kinds.length ? kinds : ["other"];
  }
  if (label === "Goal") return ["goal"];
  if (label === "Prompt mode") return ["plan"];
  if (label.startsWith("To-do list")) return ["todos"];
  if (label === "Queued messages") return ["queue"];
  if (label === "Model fallback") return ["fallback"];
  if (/background/i.test(label)) return ["background"];
  if (/workflow/i.test(label) || node.querySelector('[aria-label^="Workflow:"]')) return ["workflow"];
  if (node.querySelector('#machine-status-toggle') || /machine/i.test(label)) return ["machine"];
  if (label === "Thread history" || /archiv|unavailable|environment.*(gone|removed)|read.only/i.test(label) || node.querySelector('#thread-prompt-banner-status-toggle')) return node.querySelector('#thread-prompt-banner-parent-thread-toggle') ? ["status", "parent"] : ["status"];
  return ["other"];
}
function nativeTrigger(node: HTMLElement, key: InfoKind): HTMLElement | null {
  const selector = key === "diff" ? '#thread-prompt-banner-git-toggle'
    : key === "children" ? '#thread-prompt-banner-child-threads-toggle'
    : key === "parent" ? '#thread-prompt-banner-parent-thread-toggle'
    : key === "pullRequest" ? '[aria-label^="Pull request "]'
    : '[aria-expanded][aria-controls], button[aria-expanded]';
  return node.querySelector(selector);
}

// Manage composer information surfaces and cancel their owned work on disposal.
export function injectComposerInfo(document: Document): () => void {
  const view = document.defaultView;
  if (!view) return () => {};
  const style = document.createElement("style");
  style.id = "bb-chat-ui-composer-info";
  style.textContent = composerInfoPrefix;
  const workflowStyle = document.createElement("style");
  workflowStyle.id = "bb-chat-ui-composer-info-workflow";
  workflowStyle.textContent = composerInfoWorkflowCss;
  const tailStyle = document.createElement("style");
  tailStyle.id = "bb-chat-ui-composer-info-tail";
  tailStyle.textContent = composerInfoSuffix;
  document.head.append(style, tailStyle);
  const workflowOwners = new Set<HTMLElement>();
  const states = new Map<HTMLElement, ReturnType<typeof mount>>();
  let disposed = false;
  let frame = 0;
  let serial = 0;
  const dataDirty = new Set<HTMLElement>();
  const widthDirty = new Set<HTMLElement>();
  const cardDirty = new Set<HTMLElement>();
  let discover = true;

  function mount(stack: HTMLElement) {
    stack.setAttribute(`${MARK}-stack`, "");
    const prMerge = interceptPrMerge(stack);
    const queueControls = attachQueueControls(stack);
    const bar = document.createElement("div");
    bar.setAttribute(`${MARK}-bar`, "");
    const pills = document.createElement("div");
    pills.style.display = "contents";
    const orb = document.createElement("button");
    orb.type = "button";
    orb.setAttribute(`${MARK}-all`, "");
    orb.setAttribute("aria-expanded", "false");
    const svg = (paths: string[], attributes: Record<string, string> = {}) => {
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      for (const [name, value] of Object.entries({ viewBox:"0 0 24 24", fill:"none", stroke:"currentColor", "stroke-width":"1.5", "stroke-linecap":"round", "stroke-linejoin":"round", "aria-hidden":"true", ...attributes })) icon.setAttribute(name, value);
      for (const d of paths) { const path = document.createElementNS(icon.namespaceURI, "path"); path.setAttribute("d", d); icon.append(path); }
      return icon;
    };
    // The information stack uses a stacked-layers glyph.
    const glyph = svg(["m12 3 9 5-9 5-9-5z", "m3 13 9 5 9-5"], { [`${MARK}-glyph`]:"" });
    const foldedCount = document.createElement("span");
    foldedCount.setAttribute(`${MARK}-count`, "");
    foldedCount.setAttribute("aria-hidden", "true");
    orb.append(glyph, foldedCount);
    const iconStack = document.createElement("span");
    iconStack.setAttribute(`${MARK}-stack-icons`, ""); iconStack.setAttribute("role", "group"); iconStack.setAttribute("aria-label", "접힌 정보");
    const stackIcons = new Map<InfoKind, HTMLButtonElement>();
    iconStack.append(orb);
    const jump = document.createElement("button");
    jump.type = "button";
    // Not [hidden]: BB's layered `[hidden]{display:none!important}` would skip the transition.
    jump.setAttribute(`${MARK}-jump-off`, "");
    jump.setAttribute(`${MARK}-jump`, "");
    jump.setAttribute("aria-label", "맨 아래로 이동"); jump.title = "맨 아래로 이동";
    const jumpLabel = document.createElement("span");
    jumpLabel.setAttribute(`${MARK}-jump-label`, ""); jumpLabel.textContent = "Latest";
    jump.append(svg(["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"]), jumpLabel);
    bar.append(pills);
    stack.append(bar);
    bar.setAttribute(`${MARK}-layout`, "dock");
    pills.after(iconStack, jump);
    // The host keeps its own scroll logic; the visible control forwards to it.
    let jumpSource: HTMLButtonElement | null = null;
    let jumpVisible = false;
    const jumpReflow = composerInfoReflow(bar, jump);
    let pendingJump: ReturnType<typeof jumpReflow.capture> = null;
    const jumpWatch = new view!.MutationObserver(() => schedule(stack));
    let watchedSource: Element | null = null;
    const sourceWatch = new view!.MutationObserver(() => schedule(stack));
    const syncJump = () => {
      const host = readOnlyLabel === null && !bar.hidden ? stack.closest("[data-scroll-footer]")?.querySelector<HTMLButtonElement>(HOST_JUMP) ?? null : null;
      if (host !== jumpSource) {
        jumpSource?.removeAttribute(`${MARK}-jump-source`);
        jumpWatch.disconnect();
        jumpSource = host;
        if (host) { host.setAttribute(`${MARK}-jump-source`, ""); jumpWatch.observe(host, { attributes:true, attributeFilter:["class", "disabled"] }); }
      }
      const nextJump = !!host && !host.disabled && !host.classList.contains("invisible");
      if (nextJump !== jumpVisible && buttons.size) pendingJump = jumpReflow.capture();
      jumpVisible = nextJump;
      jump.toggleAttribute(`${MARK}-jump-off`, !jumpVisible);

    };
    jump.addEventListener("click", () => jumpSource?.click());
    let items: InfoItem[] = [];
    let readOnlyLabel: string | null = null;
    let listed = listedInfo();
    let showInactive = false;
    const owned = new Set<HTMLElement>();
    const wrappers = new Set<HTMLElement>();
    const buttons = new Map<InfoKind, HTMLButtonElement>();
    const buttonContent = new WeakMap<HTMLElement, string>();
    let measuredWidths = new WeakMap<HTMLElement, number>();
    let measuredScale = "";
    const diffHopContent = new WeakMap<HTMLElement, string>();
    const appeared = new Set<InfoKind | "all">();
    const entryAnimations = new Set<Animation>();
    const entering = new Set<HTMLElement>();
    const widthAnimations = new Map<HTMLElement, { animation:Animation; width:number }>();
    const exits = new Map<InfoKind, { node:HTMLElement; animation:Animation }>();
    const positions = new Map<HTMLElement, number>();
    const moves = new Map<HTMLElement, Animation>();
    const cancelExit = (key?:InfoKind) => {
      for (const [kind, exit] of exits) {
        if (key && kind !== key) continue;
        exits.delete(kind); exit.animation.cancel(); entryAnimations.delete(exit.animation); exit.node.remove();
      }
    };
    const leave = (key:InfoKind, button:HTMLButtonElement) => {
      if (reduced() || button.hidden || bar.hidden || !button.animate) return;
      cancelExit(key);
      const rect = button.getBoundingClientRect();
      const width = `${button.offsetWidth || rect.width}px`;
      const padding = view!.getComputedStyle(button);
      const ghost = button.cloneNode(true) as HTMLButtonElement;
      ghost.setAttribute(`${MARK}-exiting`, ""); ghost.setAttribute("aria-hidden", "true");
      ghost.removeAttribute("aria-busy"); ghost.removeAttribute("aria-controls"); ghost.disabled = true;
      Object.assign(ghost.style, { width, minWidth:"0", boxSizing:"border-box", overflow:"hidden", pointerEvents:"none", transformOrigin:"left center" });
      button.before(ghost);
      const animation = ghost.animate([
        { width, paddingLeft:padding.paddingLeft, paddingRight:padding.paddingRight, marginRight:"0px", opacity:1, transform:"none" },
        { width:"0px", paddingLeft:"0px", paddingRight:"0px", marginRight:"-8px", opacity:0, transform:"scale(.88)" },
      ], { duration:200, easing:"cubic-bezier(.4,0,.2,1)", fill:"forwards" });
      exits.set(key, { node:ghost, animation }); entryAnimations.add(animation);
      const remove = () => {
        ghost.remove(); entryAnimations.delete(animation);
        if (exits.get(key)?.animation === animation) exits.delete(key);
      };
      animation.oncancel = remove;
      animation.onfinish = () => { remove(); fit(false); };
    };
    let threadId = stack.querySelector(`[${SOURCE}]`)?.getAttribute(`${MARK}-thread`) ?? null;
    let active: InfoKind | "all" | null = null;
    let activeNode: HTMLElement | null = null;
    let menu: HTMLElement | null = null;
    let lastTrigger: HTMLElement | null = null;
    let hoverPreview = false;
    let hoverOpenTimer: number | undefined;
    let hoverCloseTimer: number | undefined;
    const cancelHover = () => {
      view!.clearTimeout(hoverOpenTimer); view!.clearTimeout(hoverCloseTimer);
      hoverOpenTimer = hoverCloseTimer = undefined;
    };
    let signature = "";
    let catalogCount = 0;
    let stackMore = 0;
    const stackCountTimers = new Map<HTMLElement, number>();
    const renderStackCount = () => {
      const pending = Array.from(stackCountTimers.keys()).filter(node => node.parentElement === iconStack).length;
      const more = stackMore + pending;
      const count = `+${more}`;
      if (foldedCount.textContent !== count) foldedCount.textContent = count;
      const label = `전체 정보 ${catalogCount}개 · 더 보기 ${more}개`;
      if (orb.getAttribute("aria-label") !== label) { orb.setAttribute("aria-label", label); orb.title = label; }
    };
    const finishStackCount = (node:HTMLElement, timer:number | undefined) => {
      if (timer === undefined || stackCountTimers.get(node) !== timer) return;
      view!.clearTimeout(timer); stackCountTimers.delete(node); renderStackCount();
    };
    const cancelStackCount = () => {
      for (const timer of stackCountTimers.values()) view!.clearTimeout(timer);
      stackCountTimers.clear(); renderStackCount();
    };
    let avatarCap = 3;
    let childTotal = 0;
    let childStates = new Map<string, ChildState>();
    let queueSnapshot:{ count:number; seenIds:Set<string>; pendingRows:number; pendingCount:number } | null = null;
    const queueMotions = new Set<QueueLiquidMotion>();
    const queueTimers = new Set<number>();
    // Cancel all surfaces and delayed flights owned by this composer scope.
    const cancelQueueMotion = () => {
      for (const timer of queueTimers) view!.clearTimeout(timer);
      queueTimers.clear();
      for (const motion of queueMotions) motion.cancel();
      queueMotions.clear();
    };
    let diffSupplement: HTMLElement | null = null;
    let parentArm: HTMLElement | null = null;
    const panelActions = new Map<HTMLElement, HTMLButtonElement>();
    const panelHeadings = new Set<HTMLElement>();
    const generatedHeadings = new Set<HTMLElement>();
    const nativeDismisses = new Map<HTMLElement, HTMLButtonElement>();
    const readOnlyTitles = new Map<HTMLElement, { tabIndex:string | null; ariaDisabled:string | null }>();
    const machineRetrySlots = new Set<HTMLElement>();
    let forwardingTitle = false;
    const clickNativeTitle = (button:HTMLElement) => {
      forwardingTitle = true;
      try { button.click(); } finally { forwardingTitle = false; }
    };
    const blockTitleActivation = (event:Event) => {
      if (forwardingTitle || !(event.target instanceof view!.Element)) return;
      const title = event.target.closest<HTMLElement>(`[${MARK}-readonly-title]`);
      if (!title || !activeNode?.contains(title) || !activeNode.hasAttribute(OPEN)) return;
      if (event instanceof view!.KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    stack.addEventListener("click", blockTitleActivation, true);
    stack.addEventListener("keydown", blockTitleActivation, true);
    const restoreTitle = (title:HTMLElement) => {
      const saved = readOnlyTitles.get(title);
      if (!saved) return;
      for (const [name,value] of [["tabindex",saved.tabIndex],["aria-disabled",saved.ariaDisabled]] as const) {
        if (value === null) title.removeAttribute(name); else title.setAttribute(name,value);
      }
      title.removeAttribute(`${MARK}-readonly-title`); readOnlyTitles.delete(title);
    };
    const parentRows = new Map<HTMLElement, HTMLButtonElement>();
    // Markers the CSS reads instead of :has() (a generic-subject :has() restyles the app on every row insertion).
    const setMark = (node: Element, name: string, on: boolean) => { if (node.hasAttribute(name) !== on) node.toggleAttribute(name, on); };
    const WITH_PARENT_ROW = `${MARK}-with-parent-row`, WITH_PARENT_BODY = `${MARK}-with-parent-body`;
    const PARENT_TOGGLE_WRAP = `${MARK}-parent-toggle-wrap`, PARENT_LINK_WRAP = `${MARK}-parent-link-wrap`;
    const clearParentMarks = (host: HTMLElement) => {
      host.removeAttribute(WITH_PARENT_ROW); host.removeAttribute(WITH_PARENT_BODY);
      host.removeAttribute(cardSlot.layout);
      for (const node of Array.from(host.querySelectorAll(`[${PARENT_TOGGLE_WRAP}], [${PARENT_LINK_WRAP}]`))) {
        node.removeAttribute(PARENT_TOGGLE_WRAP); node.removeAttribute(PARENT_LINK_WRAP);
      }
    };
    const markParent = (host: HTMLElement) => {
      setMark(host, WITH_PARENT_ROW, true);
      if (host.getAttribute(cardSlot.layout) !== "single-row") host.setAttribute(cardSlot.layout, "single-row");
      setMark(host, WITH_PARENT_BODY, host.querySelector("#thread-prompt-banner-parent-thread-body") !== null);
      for (const child of Array.from(host.children)) setMark(child, PARENT_TOGGLE_WRAP, child.tagName === "DIV" && child.querySelector("#thread-prompt-banner-parent-thread-toggle") !== null);
      for (const span of Array.from(host.querySelectorAll("span"))) setMark(span, PARENT_LINK_WRAP, Array.from(span.children).some(child => child.tagName === "A"));
    };
    const droppedParents = new WeakSet<HTMLElement>();
    const collapseRows = new Set<HTMLElement>();
    // A shared host card (diff · PR · parent) keeps one head per family.
    const closeHeadings = new Map<HTMLElement, InfoKind | "all" | null>();
    const addedHeadSlots = new Set<HTMLElement>();
    const generatedCloseHeadings = new Set<HTMLElement>();
    const prSingleRows = new Set<HTMLElement>();
    const goalClearLabels = new Map<HTMLElement, HTMLElement>();
    const planExitLabels = new Map<HTMLElement, HTMLElement>();
    const fallbackDismissLabels = new Map<HTMLElement, HTMLElement>();
    const endActions = new Map<HTMLElement, InfoKind>();
    const actionLayouts = new Map<HTMLElement, string | null>();
    const markEndAction = (node:HTMLElement, key:InfoKind) => {
      if (!node.hasAttribute(cardSlot.endAction)) { node.setAttribute(cardSlot.endAction, ""); endActions.set(node, key); }
      for (const detail of Array.from(node.parentElement?.querySelectorAll<HTMLElement>(`:scope > [${MARK}-panel-action]`) ?? [])) {
        if (node.compareDocumentPosition(detail) & view!.Node.DOCUMENT_POSITION_FOLLOWING) node.before(detail);
      }
    };
    const restoreActionLayout = (node:HTMLElement) => {
      if (!actionLayouts.has(node)) return;
      const original = actionLayouts.get(node)!;
      if (original === null) node.removeAttribute(cardSlot.layout); else node.setAttribute(cardSlot.layout, original);
      actionLayouts.delete(node);
    };
    let prTitle: HTMLElement | null = null;
    let prHeading: HTMLElement | null = null;
    let prLink: HTMLAnchorElement | null = null;
    let prLinkTitle: string | null = null;
    let prLinkNavigation: string | null = null;
    const backgroundAccordions = createBackgroundAccordions(document);
    const clearPrHeader = () => {
      prTitle?.remove(); prTitle = null;
      prHeading?.removeAttribute(`${MARK}-pr-heading`); prHeading = null;
      if (prLink) {
        if (prLinkTitle === null) prLink.removeAttribute("title"); else prLink.setAttribute("title",prLinkTitle);
        if (prLinkNavigation === null) prLink.removeAttribute(cardSlot.navigation); else prLink.setAttribute(cardSlot.navigation,prLinkNavigation);
      }
      prLink = null; prLinkTitle = null; prLinkNavigation = null;
    };
    const bulkActions = new Map<HTMLElement, {ariaLabel:string|null; title:string|null; icon:Element; source:string}>();
    const agentationCloses = new Set<HTMLElement>();
    const restoreBulkAction = (button:HTMLElement) => {
      const saved=bulkActions.get(button);if(!saved)return;
      saved.icon.remove();button.removeAttribute(`${MARK}-bulk-action`);button.removeAttribute(cardSlot.action);
      for(const [key,value] of [["aria-label",saved.ariaLabel],["title",saved.title]] as const){
        if(value===null)button.removeAttribute(key);else button.setAttribute(key,value);
      }
      bulkActions.delete(button);
    };
    const syncBulkActions = (host:HTMLElement|null) => {
      const current=new Set<HTMLElement>();
      for(const button of Array.from(host?.querySelectorAll<HTMLElement>(':scope > div:first-child > div:last-child > button')??[])){
        let saved=bulkActions.get(button);
        const label=Array.from(button.childNodes).filter(node=>node!==saved?.icon).map(node=>node.textContent).join('').trim();
        const kind=label==='Discard all'?'discard':label==='Send all'||label==='Sending…'?'send':null;
        if(!kind)continue;
        const artwork=kind==='send'
          ?Array.from(button.querySelectorAll('svg,[data-icon-root]')).find(node=>!node.closest(`[${MARK}-bulk-icon]`))
          :host?.querySelector('li button[aria-label="Discard annotation"] :is(svg,[data-icon-root])');
        if(!artwork&&!saved)continue;
        if(!saved){saved={ariaLabel:button.getAttribute('aria-label'),title:button.getAttribute('title'),icon:artwork!.cloneNode(true) as Element,source:''};bulkActions.set(button,saved);}
        if(artwork&&saved.source!==artwork.outerHTML){
          saved.icon.remove();saved.source=artwork.outerHTML;saved.icon=artwork.cloneNode(true) as Element;
          for(const node of [saved.icon,...Array.from(saved.icon.querySelectorAll('[id]'))])node.removeAttribute('id');
          saved.icon.setAttribute(`${MARK}-bulk-icon`,'');saved.icon.setAttribute('aria-hidden','true');
        }
        if(saved.icon.parentElement!==button)button.append(saved.icon);
        if(button.getAttribute(`${MARK}-bulk-action`)!==kind)button.setAttribute(`${MARK}-bulk-action`,kind);
        if(!button.hasAttribute(cardSlot.action))button.setAttribute(cardSlot.action,'');
        if(button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
        if(button.getAttribute('title')!==label)button.setAttribute('title',label);
        current.add(button);
      }
      for(const button of bulkActions.keys())if(!current.has(button))restoreBulkAction(button);
    };
    const syncNativeControls = () => {
      const currentRows = new Set<HTMLElement>();
      for (const row of Array.from(stack.querySelectorAll<HTMLElement>(WORKFLOW_COLLAPSE))) {
        row.setAttribute(`${MARK}-collapse`, ""); currentRows.add(row);
      }
      for (const item of items) {
        const controls = item.trigger?.getAttribute("aria-controls");
        if (!controls || item.key === "diff") continue;
        for (const button of Array.from(item.node.querySelectorAll<HTMLElement>('button[aria-label^="Collapse "][aria-controls]'))) {
          if (button === item.trigger || button.getAttribute("aria-controls") !== controls) continue;
          // Only the disclosure for this card, never a list or phase inside it.
          const row = button.parentElement?.children.length === 1 ? button.parentElement : button;
          row.setAttribute(`${MARK}-collapse`, ""); currentRows.add(row);
        }
      }
      for (const row of collapseRows) if (!currentRows.has(row)) row.removeAttribute(`${MARK}-collapse`);
      collapseRows.clear(); currentRows.forEach(row => collapseRows.add(row));
      for (const [node, button] of nativeDismisses) if (node !== activeNode || !node.hasAttribute(OPEN)) {
        button.remove(); nativeDismisses.delete(node);
      }
      for (const [heading, family] of closeHeadings) if (!activeNode?.contains(heading) || !activeNode.hasAttribute(OPEN) || family !== active) {
        heading.removeAttribute(`${MARK}-close-heading`);
        if (addedHeadSlots.delete(heading)) heading.removeAttribute(cardSlot.head);
        closeHeadings.delete(heading);
        if (generatedCloseHeadings.delete(heading)) heading.remove();
      }
      const item = items.find(item => item.node === activeNode && item.key === active);
      for (const [node, key] of endActions) if (key !== item?.key || !item.node.hasAttribute(OPEN) || !item.node.contains(node)) {
        node.removeAttribute(cardSlot.endAction); endActions.delete(node);
      }
      for (const node of actionLayouts.keys()) if (node !== item?.node || !node.hasAttribute(OPEN)) restoreActionLayout(node);
      for (const card of prSingleRows) if (item?.key !== "pullRequest" || item.node !== card || !card.hasAttribute(OPEN)) {
        card.removeAttribute(cardSlot.layout); prSingleRows.delete(card);
      }
      for (const title of readOnlyTitles.keys()) if (title !== item?.trigger || !item.node.hasAttribute(OPEN)) restoreTitle(title);
      if (item?.key !== "pullRequest" || !item.node.hasAttribute(OPEN)) clearPrHeader();
      const backgroundHost = item?.key === "background" && item.node.hasAttribute(OPEN) ? item.node : null;
      backgroundAccordions.sync(backgroundHost, readInfoData(stack.querySelector(`[${SOURCE}]`))?.value.background ?? []);
      const escapeAttr = (value: string) => view?.CSS?.escape(value) ?? value.replace(/["\\]/g, "\\$&");
      const readParent = () => readInfoData(stack.querySelector(`[${SOURCE}]`))?.value.parent ?? null;
      const parentHost = item?.key === "parent" && item.node.hasAttribute(OPEN) ? item.node : null;
      for (const [host, row] of parentRows) if (host !== parentHost) { row.remove(); parentRows.delete(host); clearParentMarks(host); }
      if (parentHost) {
        const parent = readParent();
        const currentRow = parentRows.get(parentHost);
        const nativeParentLink = () => parentHost.querySelector<HTMLAnchorElement>('a[href*="/threads/"]');
        const remembered = currentRow?.getAttribute(`${MARK}-parent-row`) ?? "";
        const blocked = Boolean(remembered) || droppedParents.has(parentHost);
        if (parent) droppedParents.delete(parentHost);
        else if (blocked) droppedParents.add(parentHost);
        const title = parent?.title ?? (blocked ? "" : nativeParentLink()?.textContent?.replace(/\s+/g, " ").trim() ?? "");
        if (!title) { currentRow?.remove(); parentRows.delete(parentHost); clearParentMarks(parentHost); }
        else {
          let row = currentRow;
          if (!row) {
            row = document.createElement("button");
            row.type = "button";
            row.setAttribute(cardSlot.row, "");
            row.setAttribute(cardSlot.navigation, "");
            const parentRow = row;
            parentRow.addEventListener("click", () => {
              const current = readParent();
              if (current) {
                const openThread = readInfoData(stack.querySelector(`[${SOURCE}]`))?.value.openThread;
                if (openThread) { openThread(current.id); return; }
                nativeParentLink()?.click();
                return;
              }
              if (parentRow.getAttribute(`${MARK}-parent-row`)) return;
              nativeParentLink()?.click();
            });
            parentRows.set(parentHost, row);
          }
          const id = parent?.id ?? "";
          if (row.getAttribute(`${MARK}-parent-row`) !== id) row.setAttribute(`${MARK}-parent-row`, id);
          if (row.getAttribute("aria-label") !== title) row.setAttribute("aria-label", title);
          const artwork = parent ? stack.querySelector(`[${MARK}-parent-icon="${escapeAttr(parent.id)}"]`)?.firstElementChild : null;
          const icon = document.createElement("span");
          icon.setAttribute(`${MARK}-provider-icon`, ""); icon.setAttribute("aria-hidden", "true");
          if (artwork) { const copy = artwork.cloneNode(true) as Element; copy.removeAttribute("id"); icon.append(copy); }
          const label = document.createElement("span");
          label.setAttribute(`${MARK}-parent-title`, ""); label.textContent = title;
          const wantIcon = icon.innerHTML;
          if (row.querySelector(`[${MARK}-parent-title]`)?.textContent !== title || (row.querySelector(`[${MARK}-provider-icon]`)?.innerHTML ?? "") !== wantIcon) {
            row.replaceChildren(...(wantIcon ? [icon, label] : [label]));
          }
          const head = parentHost.querySelector(`:scope > [${cardSlot.head}]`);
          if (head) { if (head.nextElementSibling !== row) head.after(row); }
          else if (row.parentElement !== parentHost) parentHost.prepend(row);
          markParent(parentHost);
        }
      }
      const namedAction = (labels: Map<HTMLElement, HTMLElement>, key: InfoKind, selector: string, mark: string, textFor: (button: HTMLElement) => string) => {
        for (const [button, label] of labels) if (item?.key !== key || !item.node.hasAttribute(OPEN) || !item.node.contains(button)) {
          label.remove(); labels.delete(button); button.removeAttribute(cardSlot.button);
        }
        if (item?.key !== key || !item.node.hasAttribute(OPEN)) return;
        const button = item.node.querySelector<HTMLElement>(selector);
        if (!button) return;
        let label = labels.get(button);
        if (!label) { label = document.createElement("span"); label.setAttribute(mark, ""); label.setAttribute(cardSlot.buttonLabel, ""); labels.set(button, label); }
        const text = textFor(button);
        if (label.textContent !== text) label.textContent = text;
        if (label.parentElement !== button) button.append(label);
        if (!button.hasAttribute(cardSlot.button)) button.setAttribute(cardSlot.button, "");
        markEndAction(button, key);
      };
      namedAction(goalClearLabels, "goal", '[aria-label="Clear active Goal"]', `${MARK}-goal-clear-label`, button => button.hasAttribute("disabled") ? "해제 중…" : "해제");
      namedAction(planExitLabels, "plan", '[aria-label="Exit plan mode"]', `${MARK}-plan-exit-label`, button => button.hasAttribute("disabled") ? "종료 중…" : "종료");
      namedAction(fallbackDismissLabels, "fallback", '[aria-label="Dismiss model fallback"]', `${MARK}-fallback-dismiss-label`, () => "해제");
      for (const button of machineRetrySlots) if (item?.key !== "machine" || !item.node.hasAttribute(OPEN) || !item.node.contains(button)) {
        button.removeAttribute(cardSlot.button); machineRetrySlots.delete(button);
      }
      if (item?.key === "machine" && item.node.hasAttribute(OPEN)) {
        for (const button of Array.from(item.node.querySelectorAll<HTMLButtonElement>('button:not([aria-expanded])'))) {
          if (button.textContent?.trim() === "Retry" && !button.hasAttribute(cardSlot.button)) {
            button.setAttribute(cardSlot.button, ""); machineRetrySlots.add(button);
          }
        }
      }
      syncBulkActions(item?.key === "annotations" && item.node.hasAttribute(OPEN) ? item.node : null);
      for (const button of agentationCloses) if (!(item?.key === "annotations" && item.node.hasAttribute(OPEN) && item.node.contains(button))) { button.removeAttribute(cardSlot.close); agentationCloses.delete(button); }
      if (item?.key === "annotations" && item.node.hasAttribute(OPEN)) {
        const collapse = item.node.querySelector<HTMLElement>('button[aria-label="Collapse staged annotations"]');
        if (collapse && !collapse.hasAttribute(cardSlot.close)) { collapse.setAttribute(cardSlot.close, ""); agentationCloses.add(collapse); }
      }
      if (!item || !item.node.hasAttribute(OPEN) || item.key === "diff" || item.node.matches(".agentation-staging-shell") || item.node.querySelector(`[${MARK}-dismiss]:not([${MARK}-native-dismiss])`)) return;
      let heading:HTMLElement | null = null;
      if (item.key === "pullRequest" || item.node.getAttribute(cardSlot.layout) !== "single-row") {
        heading = item.node.querySelector<HTMLElement>(`[${MARK}-panel-heading], [${MARK}-close-heading], :scope > [${cardSlot.head}]`);
        if (!heading || heading.closest("button, a")) {
          let parent = item.trigger?.parentElement;
          // github-pr-status wraps the PR link in display:contents slots; the header is the card's own row.
          if (item.key === "pullRequest") while (parent && parent !== item.node && parent.parentElement !== item.node) parent = parent.parentElement;
          heading = parent && parent !== item.node && !parent.closest("button, a") && !parent.hasAttribute("data-queued-messages-mode") ? parent : item.trigger;
          if (!item.trigger) heading = item.node.querySelector<HTMLElement>("h3, h4, header");
          if (heading?.hasAttribute("data-queued-messages-mode") || item.key === "queue" || item.key === "goal" || item.key === "parent") heading = null;
        }
        if (!heading) {
          heading = document.createElement("h3"); heading.textContent = item.label;
          item.node.prepend(heading); generatedCloseHeadings.add(heading);
        }
        if (!heading.hasAttribute(`${MARK}-close-heading`)) heading.setAttribute(`${MARK}-close-heading`, "");
        if (!heading.hasAttribute(cardSlot.head)) { heading.setAttribute(cardSlot.head, ""); addedHeadSlots.add(heading); }
        closeHeadings.set(heading, item.key);
        if (item.key === "pullRequest") {
          if (item.node.getAttribute(cardSlot.layout) !== "single-row") item.node.setAttribute(cardSlot.layout, "single-row");
          prSingleRows.add(item.node);
          const link = heading.querySelector<HTMLAnchorElement>('a[aria-label^="Pull request "][href]');
          if (link) {
            if (prHeading !== heading || prLink !== link) clearPrHeader();
            prHeading = heading; prHeading.setAttribute(`${MARK}-pr-heading`, "");
            if (prLink !== link) { prLink = link; prLinkTitle = link.getAttribute("title"); prLinkNavigation = link.getAttribute(cardSlot.navigation); }
            if (!link.hasAttribute(cardSlot.navigation)) link.setAttribute(cardSlot.navigation, "");
            if (link.getAttribute("title") !== "GitHub에서 PR 열기") link.setAttribute("title","GitHub에서 PR 열기");
            prTitle ??= document.createElement("span");
            prTitle.setAttribute(`${MARK}-pr-title`, "");
            const title = stack.querySelector(`[${SOURCE}]`)?.getAttribute(`${MARK}-pr-title`) || link.textContent?.trim() || "Pull request";
            if (prTitle.textContent !== title) prTitle.textContent = title;
            if (prTitle.getAttribute("title") !== title) prTitle.setAttribute("title",title);
            if (prTitle.previousElementSibling !== link) link.after(prTitle);
          } else clearPrHeader();
          let actions = heading.querySelector<HTMLElement>('div.inline-flex.overflow-hidden.rounded[class~="border"]');
          if (actions) {
            while (actions.parentElement && actions.parentElement !== heading && !actions.parentElement.hasAttribute("data-bb-plugin-root")) actions = actions.parentElement;
            markEndAction(actions, item.key);
          }
        }
        const title = item.trigger;
        if (title?.matches('button[aria-expanded][aria-controls]') && heading.contains(title) && item.key !== "pullRequest") {
          if (!readOnlyTitles.has(title)) readOnlyTitles.set(title,{tabIndex:title.getAttribute("tabindex"),ariaDisabled:title.getAttribute("aria-disabled")});
          if (!title.hasAttribute(`${MARK}-readonly-title`)) title.setAttribute(`${MARK}-readonly-title`,"");
          if (title.getAttribute("tabindex") !== "-1") title.setAttribute("tabindex","-1");
          if (title.getAttribute("aria-disabled") !== "true") title.setAttribute("aria-disabled","true");
        }
      }
      const stateAction = item.node.querySelector<HTMLElement>(`[${cardSlot.button}][${cardSlot.endAction}]`);
      if (heading && stateAction && !heading.contains(stateAction)) {
        const goalControls = stateAction.closest<HTMLElement>('[aria-label="Goal controls"]');
        if (goalControls?.parentElement === item.node) markEndAction(goalControls, item.key);
        if (!actionLayouts.has(item.node)) actionLayouts.set(item.node, item.node.getAttribute(cardSlot.layout));
        if (item.node.getAttribute(cardSlot.layout) !== "with-actions") item.node.setAttribute(cardSlot.layout, "with-actions");
      } else restoreActionLayout(item.node);
      let dismiss = nativeDismisses.get(item.node);
      if (!dismiss) {
        dismiss = createCardClose(document, `${item.label} 닫기`);
        dismiss.setAttribute(`${MARK}-dismiss`, ""); dismiss.setAttribute(`${MARK}-native-dismiss`, "");
        nativeDismisses.set(item.node, dismiss);
      }
      const dismissLabel = `${item.label} 닫기`;
      if (dismiss.getAttribute("aria-label") !== dismissLabel) { dismiss.setAttribute("aria-label", dismissLabel); dismiss.title = dismissLabel; }
      if (dismiss.parentElement !== item.node) item.node.append(dismiss);
    };
    const panelAction = (label:string, run:() => void) => {
      const button = createCardAction(document, label, "M15 3h6v6m0-6L10 14M11 3H7a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-4");
      button.setAttribute(`${MARK}-panel-action`, "");
      button.addEventListener("click", run);
      return button;
    };
    const syncPanelActions = () => {
      const current = new Set<HTMLElement>();
      for (const item of items) {
        if (item.key === "diff") continue;
        for (const source of Array.from(item.node.querySelectorAll<HTMLElement>(`button:not([${MARK}-panel-action]), a[href]`))) {
          const label = [source.getAttribute("aria-label"), source.getAttribute("title"), source.textContent]
            .map(text => text?.trim().replace(/\s+/g, " ") ?? "")
            .find(text => /^(?:(?:사이드|사이드바|측면|옆)\s*패널(?:에서)?\s*열기|플러그인\s*페이지(?:에서)?\s*열기|open (?:in )?(?:the )?(?:side ?panel|sidebar|plugin page)|open workflow .+ in side panel)$/i.test(text));
          if (!label) continue;
          current.add(source);
          let heading = item.node.querySelector<HTMLElement>(`[${MARK}-panel-heading], [${MARK}-close-heading], [${MARK}-title-heading], h3, h4, header`);
          if (!heading || heading.closest("button, a")) {
            const parent = item.trigger?.parentElement;
            const group = source.closest<HTMLElement>('[role="group"]') ?? (item.key !== "goal" && item.key !== "queue" && parent !== item.node && parent?.contains(source) ? parent : null);
            heading = group && item.node.contains(group) ? group : null;
            if (!heading) {
              heading = document.createElement("h3"); heading.textContent = item.label;
              item.node.prepend(heading); generatedHeadings.add(heading);
            }
          }
          if (!heading.hasAttribute(`${MARK}-panel-heading`)) {
            heading.setAttribute(`${MARK}-panel-heading`, ""); panelHeadings.add(heading);
          }
          let action = panelActions.get(source);
          if (!action) {
            action = panelAction(label, () => { if (close()) source.click(); });
            panelActions.set(source, action); source.setAttribute(`${MARK}-panel-source`, "");
          }
          const end = heading.querySelector(`:scope > [${cardSlot.endAction}], :scope > [${MARK}-dismiss]`);
          if (action.parentElement !== heading || end && !(action.compareDocumentPosition(end) & view!.Node.DOCUMENT_POSITION_FOLLOWING)) heading.insertBefore(action, end);
          if (action.title !== label) action.title = label;
          if (action.getAttribute("aria-label") !== label) action.setAttribute("aria-label", label);
          const disabled = source.hasAttribute("disabled") || source.getAttribute("aria-disabled") === "true";
          if (action.disabled !== disabled) action.disabled = disabled;
        }
      }
      for (const [source, action] of panelActions) if (!current.has(source)) {
        action.remove(); source.removeAttribute(`${MARK}-panel-source`); panelActions.delete(source);
      }
      for (const heading of panelHeadings) if (!heading.querySelector(`[${MARK}-panel-action]`)) {
        heading.removeAttribute(`${MARK}-panel-heading`); panelHeadings.delete(heading);
        if (generatedHeadings.delete(heading)) heading.remove();
      }
    };
    const scrollHints = (["top", "bottom"] as const).map(edge => {
      const hint = document.createElement("span");
      hint.setAttribute(`${MARK}-scroll-hint`, edge);
      hint.setAttribute("aria-hidden", "true");
      hint.hidden = true;
      bar.append(hint);
      return hint;
    });
    let edgeRoot: HTMLElement | null = null;
    let edgeScroller: HTMLElement | null = null;
    const BODY_SCROLLER = '[data-testid="plan-review-request"] > .overflow-auto, [data-testid="command-preview"] > .overflow-auto';
    const REQUEST_SHELL = '[data-testid="plan-review-banner"], [data-testid="approval-banner"]';
    const HEIGHT_SHELL = `[data-testid="plugin-interaction-shell"], ${REQUEST_SHELL}`;
    const bodyFades = new Map<HTMLElement, { above: HTMLElement; below: HTMLElement }>();
    const clipNodes = new Set<HTMLElement>();
    const secretMotions = new Map<HTMLElement, Animation>();
    const updateBodyFades = () => {
      const live = new Set<HTMLElement>();
      const liveClips = new Set<HTMLElement>();
      let anchor: DOMRect | undefined;
      for (const scroller of Array.from(stack.querySelectorAll<HTMLElement>(BODY_SCROLLER))) {
        anchor ??= stack.getBoundingClientRect();
        live.add(scroller);
        let pair = bodyFades.get(scroller);
        if (!pair) {
          const hint = (edge: "above" | "below") => {
            const node = document.createElement("span");
            node.setAttribute(`${MARK}-body-fade`, edge);
            node.setAttribute("aria-hidden", "true");
            node.hidden = true;
            return node;
          };
          pair = { above: hint("above"), below: hint("below") };
          bodyFades.set(scroller, pair);
          edgeResize?.observe(scroller);
        }
        const loose = [pair.above, pair.below].filter(node => node.parentElement !== stack);
        if (loose.length) stack.append(...loose);
        const clips = readBodyFadeClips(scroller);
        for (const clip of clips) liveClips.add(clip.node);
        // Fades sit on the stack, outside the card clip, so hide them until the height settles.
        const request = scroller.closest<HTMLElement>(REQUEST_SHELL);
        const frame = bodyFadeBox({
          anchorTop: anchor.top,
          anchorLeft: anchor.left,
          scroller: scroller.getBoundingClientRect(),
          clips,
          overflow: scrollOverflowEdges({ scrollTop: scroller.scrollTop, clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight }),
          moving: !!request && secretMotions.has(request),
        });
        const place = (node: HTMLElement, edge: { show: boolean; top: number; left: number; width: number; height: number }) => {
          node.hidden = !edge.show;
          node.style.left = `${edge.left}px`;
          node.style.width = `${edge.width}px`;
          node.style.height = `${edge.height}px`;
          node.style.top = `${edge.top}px`;
        };
        place(pair.above, frame.above);
        place(pair.below, frame.below);
      }
      for (const clip of [...clipNodes]) if (!liveClips.has(clip)) {
        edgeResize?.unobserve(clip);
        clipNodes.delete(clip);
      }
      for (const clip of liveClips) if (!clipNodes.has(clip)) {
        clipNodes.add(clip);
        edgeResize?.observe(clip);
      }
      for (const [scroller, pair] of bodyFades) if (!live.has(scroller)) {
        edgeResize?.unobserve(scroller);
        pair.above.remove();
        pair.below.remove();
        bodyFades.delete(scroller);
      }
    };
    const updateScrollHints = () => {
      updateBodyFades();
      const root = menu ?? activeNode;
      const scrollable = (node: HTMLElement) => {
        if (node.matches('textarea, input, [contenteditable="true"]')) return false;
        const css = view!.getComputedStyle(node);
        return /auto|scroll|overlay/.test(css.overflowY || css.overflow) && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1;
      };
      const scroller = root && (scrollable(root) ? root : Array.from(root.querySelectorAll<HTMLElement>("*")).filter(scrollable).sort((a, b) => b.clientHeight - a.clientHeight)[0]) || null;
      if (edgeRoot !== root || edgeScroller !== scroller) {
        edgeResize?.disconnect();
        edgeRoot = root;
        edgeScroller = scroller;
        if (root) {
          edgeResize?.observe(root);
          for (const child of Array.from(root.children)) edgeResize?.observe(child);
          if (scroller && scroller !== root) edgeResize?.observe(scroller);
        }
        for (const body of bodyFades.keys()) edgeResize?.observe(body);
        for (const clip of clipNodes) edgeResize?.observe(clip);
      }
      scrollHints.forEach(hint => { hint.hidden = true; });
      // Hints are siblings of the card and do not share its entrance opacity or
      // movement. Wait for the card to settle before measuring their edges.
      if (!scroller || root?.getAnimations?.().some(animation =>
        "animationName" in animation && animation.animationName === "bb-info-enter"
        && animation.playState !== "finished" && animation.playState !== "idle")) return;
      const rect = scroller.getBoundingClientRect();
      const anchor = bar.getBoundingClientRect();
      const height = Math.min(24, rect.height / 4);
      scrollHints.forEach((hint, index) => {
        hint.style.left = `${rect.left - anchor.left}px`;
        hint.style.width = `${rect.width}px`;
        hint.style.height = `${height}px`;
        hint.style.top = `${(index ? rect.bottom - height : rect.top) - anchor.top}px`;
        hint.hidden = index ? scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 : scroller.scrollTop <= 1;
      });
    };
    const edgeResize = typeof view!.ResizeObserver === "function" ? new view!.ResizeObserver(() => updateScrollHints()) : null;
    stack.addEventListener("scroll", updateScrollHints, true);
    stack.addEventListener("animationend", updateScrollHints, true);
    stack.addEventListener("animationcancel", updateScrollHints, true);
    const scrollRoot = (event:Event) => {
      const root = menu ?? activeNode;
      return event.target && root?.contains(event.target as Node) ? root : null;
    };
    const canScroll = (event:Event, root:HTMLElement, dx:number, dy:number) => {
      for (let node = event.target as HTMLElement | null; node; node = node.parentElement) {
        const css = view!.getComputedStyle(node);
        const available = (overflow:string, delta:number, position:number, size:number, total:number) =>
          /auto|scroll|overlay/.test(overflow) && (delta < 0 ? position > 0 : delta > 0 && position + size < total - 1);
        if (available(css.overflowY || css.overflow, dy, node.scrollTop, node.clientHeight, node.scrollHeight)
          || available(css.overflowX || css.overflow, dx, node.scrollLeft, node.clientWidth, node.scrollWidth)) return true;
        if (node === root) break;
      }
      return false;
    };
    const onWheel = (event:WheelEvent) => {
      const root = scrollRoot(event);
      if (!root || event.ctrlKey) return;
      event.stopPropagation();
      if (!canScroll(event, root, event.deltaX, event.deltaY)) event.preventDefault();
    };
    let touch:{ x:number; y:number } | null = null;
    const onTouchStart = (event:TouchEvent) => {
      touch = null;
      if (!scrollRoot(event) || event.touches.length !== 1) return;
      touch = { x:event.touches[0].clientX, y:event.touches[0].clientY };
      event.stopPropagation();
    };
    const onTouchMove = (event:TouchEvent) => {
      const root = scrollRoot(event);
      if (!root || !touch || event.touches.length !== 1) { touch = null; return; }
      const next = { x:event.touches[0].clientX, y:event.touches[0].clientY };
      event.stopPropagation();
      if (!canScroll(event, root, touch.x - next.x, touch.y - next.y)) event.preventDefault();
      touch = next;
    };
    const endTouch = () => { touch = null; };
    stack.addEventListener("wheel", onWheel, { passive:false });
    stack.addEventListener("touchstart", onTouchStart, { passive:true });
    stack.addEventListener("touchmove", onTouchMove, { passive:false });
    stack.addEventListener("touchend", endTouch);
    stack.addEventListener("touchcancel", endTouch);
    const editing = () => stack.querySelector('[data-queued-message-inline-editor]') !== null;
    const reduced = () => view!.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const slot = () => iconStack;
    const ownedMotion = new Map<Element, Set<Animation>>();
    const pressHeld = new Set<HTMLElement>();
    const pressControls = new WeakMap<HTMLElement, { down(): void; up(): void }>();
    const remember = (node: Element) => {
      const before = new Set(node.getAnimations?.() ?? []);
      return () => {
        const created = (node.getAnimations?.() ?? []).filter(animation => !before.has(animation));
        if (!created.length) return;
        let tracked = ownedMotion.get(node);
        if (!tracked) ownedMotion.set(node, tracked = new Set());
        for (const animation of created) {
          tracked.add(animation);
          const fill = animation.effect?.getTiming?.().fill;
          // A held press uses fill forwards. Keep that effect until up, cancel, or removal.
          if (fill === "forwards" || fill === "both") continue;
          const finish = animation.onfinish;
          const cancel = animation.oncancel;
          const drop = () => {
            tracked!.delete(animation);
            if (!tracked!.size) ownedMotion.delete(node);
          };
          animation.onfinish = event => { finish?.call(animation, event); drop(); };
          animation.oncancel = event => { cancel?.call(animation, event); drop(); };
        }
      };
    };
    const forgetMotion = (node: Element) => {
      const tracked = ownedMotion.get(node);
      if (!tracked) return;
      for (const animation of tracked) animation.cancel();
      ownedMotion.delete(node);
    };
    const cancelOwnedMotion = () => {
      jumpReflow.cancel(); pendingJump = null;
      for (const node of [...ownedMotion.keys()]) forgetMotion(node);
      pressHeld.clear();
    };
    // Cancel motion when React removes either endpoint before the flight finishes.
    const pruneDisconnected = () => {
      for (const node of [...ownedMotion.keys()]) if (!node.isConnected) forgetMotion(node);
      for (const motion of queueMotions) {
        if (!motion.source.isConnected || !motion.target.isConnected) {
          motion.cancel();queueMotions.delete(motion);
        }
      }
    };
    const pressOf = (node: HTMLElement) => {
      let control = pressControls.get(node);
      if (!control) { control = pressPop(node); pressControls.set(node, control); }
      return control;
    };
    const pressTarget = (target: EventTarget | null) => {
      const button = target instanceof view!.Element ? target.closest<HTMLElement>(`[${MARK}-trigger], [${MARK}-stack-kind], [${MARK}-all]`) : null;
      if (!button || !bar.contains(button)) return null;
      return button;
    };
    const canPress = (node: HTMLElement) => !reduced() && !bar.hidden && !node.hidden
      && !node.hasAttribute("disabled") && node.getAttribute("aria-disabled") !== "true"
      && !(node instanceof view!.HTMLButtonElement && node.disabled);
    const pressDown = (node: HTMLElement) => {
      if (!canPress(node) || pressHeld.has(node)) return;
      forgetMotion(node);
      const done = remember(node);
      pressOf(node).down();
      done();
      pressHeld.add(node);
    };
    const pressUp = (node: HTMLElement) => {
      if (!pressHeld.has(node)) return;
      pressHeld.delete(node);
      if (!canPress(node)) { forgetMotion(node); return; }
      forgetMotion(node);
      const done = remember(node);
      pressOf(node).up();
      done();
    };
    const pressCancel = (node: HTMLElement) => {
      if (!pressHeld.has(node)) return;
      pressHeld.delete(node);
      forgetMotion(node);
    };
    const releasePress = () => { for (const node of [...pressHeld]) pressUp(node); };
    const cancelPress = () => { for (const node of [...pressHeld]) pressCancel(node); };
    bar.addEventListener("pointerdown", event => { const node = pressTarget(event.target); if (node) pressDown(node); });
    document.addEventListener("pointerup", releasePress);
    document.addEventListener("pointercancel", cancelPress);
    view!.addEventListener("blur", cancelPress);
    bar.addEventListener("keydown", event => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      const node = pressTarget(event.target);
      if (node) pressDown(node);
    });
    bar.addEventListener("keyup", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const node = pressTarget(event.target);
      if (node) pressUp(node);
    });
    bar.addEventListener("focusout", event => { const node = pressTarget(event.target); if (node) pressCancel(node); });
    const mark = (node: HTMLElement, attr: string, collection: Set<HTMLElement>) => {
      collection.add(node);
      if (!node.hasAttribute(attr)) node.setAttribute(attr, "");
    };
    const labelOf = (key: InfoKind) => infoKinds.find(kind => kind.key === key)!.label;
    const emptyIcon = (key: InfoKind) => stack.querySelector(`[${MARK}-icon="${key}"] svg, [${MARK}-icon="${key}"] [data-icon-root]`);
    let titleHeading: HTMLElement | null = null;
    let titleIcon: HTMLElement | null = null;
    let titleArtwork = "";
    const titleSources = new Set<Element>();
    const nativeTitles = new Set<HTMLElement>();
    let titleHeadMarked: HTMLElement | null = null;
    const clearTitleIcon = () => {
      titleIcon?.remove(); titleHeading?.removeAttribute(`${MARK}-title-heading`);
      if (titleHeadMarked && !closeHeadings.has(titleHeadMarked)) titleHeadMarked.removeAttribute(cardSlot.head);
      titleHeadMarked = null;
      for (const title of nativeTitles) title.removeAttribute(cardSlot.title);
      nativeTitles.clear();
      for (const source of titleSources) source.removeAttribute(`${MARK}-title-source`);
      titleSources.clear(); titleHeading = titleIcon = null; titleArtwork = "";
    };
    const syncTitleIcon = () => {
      const item = items.find(item => item.node === activeNode && item.key === active);
      const heading = active && active !== "all" && activeNode?.getAttribute(cardSlot.layout) !== "single-row" ? menu?.querySelector<HTMLElement>("header")
        ?? (activeNode?.matches(".agentation-staging-shell")
          ? activeNode.querySelector<HTMLElement>(":scope > div:first-child > div:first-child > p")
          : activeNode?.querySelector<HTMLElement>(`[${MARK}-close-heading], [${MARK}-panel-heading], h3, h4, header`)) : null;
      if (heading !== titleHeading || titleIcon && titleIcon.parentElement !== heading) clearTitleIcon();
      if (!heading || !active || active === "all") return;
      titleHeading = heading;
      heading.setAttribute(`${MARK}-title-heading`, active);
      if (!heading.hasAttribute(cardSlot.head)) { heading.setAttribute(cardSlot.head, ""); titleHeadMarked = heading; }
      const nativeLabel = item?.trigger?.querySelector<HTMLElement>(':scope > span[class~="truncate"], :scope > span[class~="flex-1"]');
      const label = nativeLabel?.querySelector<HTMLElement>('span:first-child') ?? nativeLabel;
      for (const title of nativeTitles) if (title !== label) { title.removeAttribute(cardSlot.title); nativeTitles.delete(title); }
      if (label && !label.hasAttribute(cardSlot.title)) { label.setAttribute(cardSlot.title, ""); nativeTitles.add(label); }
      const nativeIcons = Array.from(heading.querySelectorAll("svg, [data-icon-root]"))
        .filter(icon => !icon.closest(`[${MARK}-title-icon], [${MARK}-panel-action], [${MARK}-dismiss], [${MARK}-close]`)
          && (!icon.closest("button, a") || icon.closest("button, a") === item?.trigger));
      const artwork = emptyIcon(active) ?? nativeIcons[0];
      if (artwork) {
        titleIcon ??= document.createElement("span");
        titleIcon.setAttribute(`${MARK}-title-icon`, active); titleIcon.setAttribute(cardSlot.icon, ""); titleIcon.setAttribute("aria-hidden", "true");
        if (titleArtwork !== artwork.outerHTML) {
          titleArtwork = artwork.outerHTML;
          const copy = artwork.cloneNode(true) as Element;
          copy.removeAttribute("id"); copy.removeAttribute(`${MARK}-title-source`);
          titleIcon.replaceChildren(copy);
        }
        if (heading.firstElementChild !== titleIcon) heading.prepend(titleIcon);
        for (const icon of nativeIcons) {
          const source = icon.closest(`[${cardSlot.icon}]`) ?? icon;
          source.setAttribute(`${MARK}-title-source`, ""); titleSources.add(source);
        }
      }
    };
    const childIcon = (id:string) => Array.from(stack.querySelectorAll(`[${MARK}-child-icon]`))
      .find(node => node.getAttribute(`${MARK}-child-icon`) === id)?.firstElementChild;
    const diffData = () => readDiffData(stack.querySelector(`[${HEAD_DIFF_MARK}]`));
    const readDiff = () => diffData()?.value.summary ?? null;
    const awaitingDiff = () => diffData()?.value.state === "loading";
    const diffNumber = (value:string, key:string) => {
      const number = document.createElement("span");
      number.setAttribute(`${MARK}-diff-number`, key); number.setAttribute(`${MARK}-diff-value`, value);
      number.textContent = value;
      return number;
    };
    const commitCount = (count:number) => {
      const chip = document.createElement("span"); chip.setAttribute(`${MARK}-commit-count`, "");
      chip.setAttribute("role", "img"); chip.setAttribute("aria-label", `커밋 ${count}개`);
      chip.append(commitIcon(document), diffNumber(String(count), "commits"));
      return chip;
    };
    const annotationCount = (item: InfoItem) => {
      const list = item.node.querySelector("ul");
      return list ? String(list.children.length) : item.node.querySelector(".tabular-nums")?.textContent?.trim() ?? "!";
    };
    const queueCount = (item: InfoItem) => {
      const current = item.node.querySelector('header [data-queued-messages-count]');
      const counters = current ? [current] : Array.from(item.node.querySelectorAll('header span.tabular-nums')).reverse();
      for (const counter of counters) {
        const copy = counter.cloneNode(true) as Element;
        copy.querySelectorAll('[aria-hidden="true"], [data-queued-messages-previous-count], .bb-count-roll-out').forEach(node => node.remove());
        const count = copy.textContent?.trim() ?? "";
        if (/^\d+$/.test(count)) return count;
      }
      return "";
    };
    // Detach from the input surface; the send button never supplies the origin.
    const queueAddition = (delay:number) => {
      // Launch the first drop in this paint; timers only stagger later arrivals.
      const launch = () => {
        const pill = buttons.get("queue");
        const target = pill && !pill.hidden ? pill : stackIcons.get("queue") ?? (!orb.hidden ? orb : slot());
        if (bar.hidden || reduced() || !target.isConnected || !target.animate) return;
        const shell = stack.closest("[data-promptbox-shell]");
        const origin = shell?.querySelector<HTMLElement>("[data-follow-up-composer]")
          ?? shell?.querySelector<HTMLElement>("textarea");
        if (!origin) return;
        const motion=queueLiquid(origin,target);queueMotions.add(motion);
        void motion.finished.then(()=>queueMotions.delete(motion));
      };
      if(!delay){launch();return;}
      const timer = view!.setTimeout(() => {queueTimers.delete(timer);launch();}, delay);
      queueTimers.add(timer);
    };
    const catalog = () => infoKinds.filter(kind => listed.includes(kind.key)).flatMap<InfoItem | { key:InfoKind; label:string }>(kind => {
      const available = items.filter(item => item.key === kind.key);
      if (!showInactive && !available.some(item => item.key !== "diff" || readDiff()?.presentation?.visible !== false)) return [];
      return available.length ? available : [{ key:kind.key, label:kind.label }];
    });
    const describe = (item: InfoItem) => {
      if (item.key === "diff" && awaitingDiff()) return "불러오는 중";
      if (item.key === "annotations") return `${annotationCount(item)} staged`;
      if (item.key === "queue" && queueCount(item)) return `${queueCount(item)} queued`;
      if (item.key === "diff" && readDiff()?.presentation) return readDiff()!.presentation!.label;
      const text = item.key === "diff" ? item.trigger?.textContent : item.trigger?.getAttribute("aria-label") ?? item.trigger?.textContent;
      return text?.trim().replace(/\s+/g, " ").slice(0, 200) || item.node.getAttribute("aria-label") || item.label;
    };
    const describeDiff = (item: InfoItem) => {
      const branch = item.trigger?.querySelector<HTMLElement>('[data-bb-chat-ui-branch]')?.title
        || (item.node === diffSupplement && item.trigger?.title !== "Code Diff" ? item.trigger?.title : null);
      return `${describe(item)}${branch ? `\nBranch · ${branch}` : ""}`;
    };
    const renderDiff = (container: HTMLElement, item: InfoItem) => {
      const expanded = new Set(Array.from(container.querySelectorAll(`[${MARK}-diff-toggle][aria-expanded="true"]`))
        .map(button => button.getAttribute(`${MARK}-diff-toggle`)));
      const summary = document.createElement("p"); summary.textContent = describeDiff(item);
      container.replaceChildren(summary);
      const detail = readDiff()?.detail;
      if (!detail || !Array.isArray(detail.files) || !Array.isArray(detail.commits)) return;
      container.replaceChildren();
      const overview = document.createElement("div");
      overview.setAttribute(`${MARK}-diff-overview`, "");
      container.append(overview);
      const foldRows = (list: HTMLElement, kind: "files" | "commits") => {
        const rows = Array.from(list.querySelectorAll<HTMLElement>(`[${MARK}-diff-${kind === "files" ? "file" : "commit"}]`));
        if (rows.length <= 5) return;
        list.id = `bb-composer-info-diff-${kind}-${++serial}`;
        const toggle = document.createElement("button"); toggle.type = "button";
        toggle.setAttribute(`${MARK}-diff-toggle`, kind);
        toggle.setAttribute("aria-controls", list.id);
        const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        chevron.setAttribute("viewBox", "0 0 24 24"); chevron.setAttribute("fill", "none");
        chevron.setAttribute("stroke", "currentColor"); chevron.setAttribute("stroke-width", "1.5"); chevron.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(chevron.namespaceURI, "path"); path.setAttribute("d", "m6 9 6 6 6-6"); chevron.append(path);
        const text = document.createElement("span"); toggle.append(chevron, text);
        const setExpanded = (open: boolean) => {
          rows.forEach((row, index) => { row.hidden = !open && index >= 5; });
          list.toggleAttribute(`${MARK}-diff-collapsed`, !open);
          toggle.setAttribute("aria-expanded", String(open));
          text.textContent = open ? "접기" : `${rows.length - 5}개 더 보기`;
          toggle.setAttribute("aria-label", `${kind === "files" ? "변경 파일" : "커밋"} · ${text.textContent}`);
        };
        setExpanded(expanded.has(kind));
        toggle.addEventListener("click", () => {
          setExpanded(toggle.getAttribute("aria-expanded") !== "true");
          updateScrollHints();
        });
        container.append(toggle);
      };
      const branch = document.createElement("p"); branch.setAttribute(`${MARK}-diff-branch`, "");
      const icon = emptyIcon("diff")?.cloneNode(true) as Element | undefined;
      icon?.setAttribute("aria-hidden", "true");
      const name = document.createElement("code"); name.textContent = detail.branch ?? "detached HEAD";
      if (icon) branch.append(icon);
      branch.append(name); overview.append(branch);
      const snapshot = readDiff();
      const basis = document.createElement("p");
      basis.setAttribute(`${MARK}-diff-meta`, "head");
      basis.title = detail.basis;
      basis.setAttribute("aria-label", `${detail.basis} · +${snapshot?.insertions ?? 0} −${snapshot?.deletions ?? 0} · ${detail.files.length} files`);
      const added = document.createElement("span"); added.className = "text-diff-added"; added.textContent = `+${snapshot?.insertions ?? 0}`;
      const removed = document.createElement("span"); removed.className = "text-diff-removed"; removed.textContent = `−${snapshot?.deletions ?? 0}`;
      basis.append("HEAD · ", added, " ", removed, ` · ${detail.files.length} files`);
      overview.append(basis);
      container.append(document.createElement("hr"));
      const files = document.createElement("div"); files.setAttribute(`${MARK}-diff-files`, "");
      const filesHeading = document.createElement("h4"); filesHeading.textContent = `변경 파일 · ${detail.files.length}`; files.append(filesHeading);
      if (!detail.files.length) { const empty = document.createElement("p"); empty.textContent = "-"; files.append(empty); }
      for (const file of detail.files) {
        const row = document.createElement("div"); row.setAttribute(`${MARK}-diff-file`, "");
        const path = document.createElement("code"); path.textContent = file.path; path.title = file.path;
        const status = fileStatusIcon(document, file.status);
        const stats = document.createElement("span");
        if (file.insertions === null && file.deletions === null) stats.textContent = "통계 없음";
        else {
          const added = document.createElement("span"); added.className = "text-diff-added"; added.textContent = file.insertions === null ? "—" : `+${file.insertions}`;
          const removed = document.createElement("span"); removed.className = "text-diff-removed"; removed.textContent = file.deletions === null ? "—" : `−${file.deletions}`;
          stats.append(added, " ", removed);
        }
        row.append(status, path, stats); files.append(row);
      }
      container.append(files);
      foldRows(files, "files");
      container.append(document.createElement("hr"));
      const heading = document.createElement("h4"); heading.textContent = "커밋"; container.append(heading);
      if (detail.commitKind || detail.commits.length) {
        const label = document.createElement("p");
        label.setAttribute(`${MARK}-diff-meta`, "commits");
        label.title = detail.commitKind
          ? `${detail.commitKind === "pr" ? "PR 후보" : "미푸시"} · ${detail.commitCount == null ? "확인 불가" : `${detail.commitCount} commits`} · ${detail.baseRef ?? "기준 없음"} 대비`
          : `브랜치 커밋 · ${detail.baseRef ?? "Merge base"} 대비`;
        label.setAttribute("aria-label", label.title);
        const comparison = document.createElement("code"); comparison.textContent = `${detail.baseRef ?? "?"} → HEAD`;
        const count = detail.commitCount == null ? document.createElement("span") : commitCount(detail.commitCount);
        if (detail.commitCount == null) {
          count.setAttribute(`${MARK}-commit-count`, "");
          count.setAttribute("role", "img"); count.setAttribute("aria-label", "커밋 수 확인 불가");
          count.append(commitIcon(document), "—");
        }
        label.append(comparison, " · ", count);
        if (detail.remoteBaseMissing) {
          comparison.textContent = detail.baseRef ?? "origin";
          label.replaceChildren("원격 기준 없음 · ", comparison);
          label.title = `원격 기준 없음 · ${detail.baseRef ?? "origin"}`;
          label.setAttribute("aria-label",label.title);
        }
        overview.append(label);
      }
      const commits = document.createElement("div"); commits.setAttribute(`${MARK}-diff-commits`, "");
      if (!detail.commits.length) { const empty = document.createElement("p"); empty.textContent = "-"; commits.append(empty); }
      for (const commit of [...detail.commits].sort((a,b) => (b.authoredAt ?? 0) - (a.authoredAt ?? 0))) {
        const row = document.createElement("div"); row.setAttribute(`${MARK}-diff-commit`, "");
        const graph = document.createElement("span"); graph.setAttribute(`${MARK}-diff-graph`, ""); graph.setAttribute("aria-hidden", "true");
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "svg"); dot.setAttribute("viewBox", "0 0 24 24");
        const circle = document.createElementNS(dot.namespaceURI, "circle");
        circle.setAttribute("cx", "12"); circle.setAttribute("cy", "12"); circle.setAttribute("r", "7"); dot.append(circle); graph.append(dot);
        const text = document.createElement("code"); text.textContent = `${commit.shortSha} · ${commit.subject}`; text.title = `${commit.sha} · ${commit.subject}`;
        row.append(graph, text); commits.append(row);
      }
      container.append(commits);
      foldRows(commits, "commits");
      if (detail.commitKind === "pr" && detail.unpushedCount != null) {
        const push = document.createElement("p");
        push.setAttribute(cardSlot.meta, "");
        push.textContent = `미푸시 · ${detail.unpushedCount} commits · ${detail.unpushedRef ?? "기준 없음"} 대비`;
        overview.append(push);
      }
    };
    const decorate = (button: HTMLElement, item: InfoItem, summary: boolean) => {
      const previousNumbers = new Map(Array.from(button.querySelectorAll(`[${MARK}-diff-number]`))
        .map(number => [number.getAttribute(`${MARK}-diff-number`), number.getAttribute(`${MARK}-diff-value`)]));
      const roll = summary && item.key === "diff" && button.isConnected && !button.hidden && !bar.hidden && appeared.has("diff") && !reduced();
      button.removeAttribute("aria-busy");
      if (summary && item.key === "diff" && awaitingDiff()) {
        const icon = emptyIcon("diff")?.cloneNode(true) as Element | undefined;
        icon?.setAttribute("aria-hidden", "true");
        const dots = document.createElement("span"); dots.setAttribute(`${MARK}-diff-loading`, ""); dots.setAttribute("aria-hidden", "true");
        for (let i = 0; i < 3; i++) { const dot = document.createElement("span"); dot.textContent = "."; dots.append(dot); }
        button.replaceChildren(...(icon ? [icon] : []), dots);
        button.setAttribute("aria-busy", "true");
        button.title = "Code Diff · 불러오는 중"; button.setAttribute("aria-label", button.title);
        return;
      }
      const text = document.createElement("span");
      let childCount = 0;
      text.textContent = summary && item.key === "diff" ? describe(item) : item.label;
      if (summary && item.key === "status" && readOnlyLabel) text.textContent = readOnlyLabel;
      if (summary && item.key === "todos") text.textContent = item.trigger?.textContent?.trim().replace(/\s+/g, " ").slice(0, 30) || item.label;
      if (summary && item.key === "queue") text.textContent = queueCount(item) || item.label;
      if (summary && item.key === "annotations") text.textContent = annotationCount(item);
      const presentation = item.key === "diff" ? readDiff()?.presentation : null;
      const icon = (summary && presentation && presentation.mode !== "working" ? emptyIcon("diff") : null)
        ?? (item.key === "annotations" ? emptyIcon("annotations") : null)
        ?? (item.key === "queue" ? emptyIcon("queue") : null)
        ?? (["plan", "status", "machine", "other"].includes(item.key) ? emptyIcon(item.key) : null)
        ?? (!summary ? emptyIcon(item.key) : null)
        ?? item.trigger?.querySelector("svg, [data-icon-root]") ?? item.node.querySelector("svg, [data-icon-root]") ?? emptyIcon(item.key);
      button.replaceChildren();
      if (summary && item.key === "children") {
        const avatars = document.createElement("span");
        avatars.setAttribute(`${MARK}-avatars`, "");
        let children: readonly ChildSummary[] = readInfoData(stack.querySelector(`[${SOURCE}]`))?.value.children ?? [];
        if (!children.length) children = [{ id:"native", title:describe(item).replace(/^.*?:\s*/, ""), state:describe(item).startsWith("Active child") ? "run" : "wait" }];
        childCount = childTotal = children.length;
        const stateOf = (child: ChildSummary): ChildState => child.state ?? (child.running ? "run" : "done");
        const nextStates = new Map(children.map(child => [child.id, stateOf(child)]));
        for (const [index, child] of children.slice(-avatarCap).entries()) {
          const avatar = document.createElement("span");
          avatar.setAttribute(`${MARK}-avatar`, "");
          avatar.title = child.providerId ? `${child.title} · ${child.providerId}` : child.title;
          const artwork = childIcon(child.id)?.cloneNode(true) as Element | undefined;
          if (artwork) {
            artwork.removeAttribute("id"); artwork.setAttribute(`${MARK}-provider-icon`, ""); artwork.setAttribute("aria-hidden", "true");
            avatar.append(artwork);
          } else avatar.textContent = childInitial(child.title);
          avatar.setAttribute("data-child", child.id);
          avatar.setAttribute("data-state", stateOf(child));
          avatar.setAttribute("data-unread", String(child.unread ?? false));
          avatar.style.zIndex = String(index + 1);
          const dot = document.createElement("span"); dot.setAttribute(`${MARK}-avatar-dot`, "");
          avatar.append(dot);
          if (!childStates.has(child.id)) {
            avatar.setAttribute("data-new", "");
            avatar.style.animationDelay = `${index * 45}ms`;
          }
          else if (childStates.get(child.id) !== "done" && stateOf(child) === "done" && !reduced()) avatar.animate?.([
            { transform:"scale(1)", offset:0, easing:"cubic-bezier(.36,0,.18,1)" },
            { transform:"scale(1.1)", offset:.6, easing:"cubic-bezier(.36,0,.18,1)" },
            { transform:"scale(1)", offset:1 },
          ], { duration:360 });
          avatars.append(avatar);
        }
        if (children.length > avatarCap) {
          text.textContent = `+${children.length - avatarCap}`;
          text.setAttribute(`${MARK}-avatar-more`, "");
          text.style.zIndex = "4";
          avatars.append(text);
        }
        button.append(avatars);
        childStates = nextStates;
      } else {
        if (icon) {
          const clone = icon.cloneNode(true) as Element;
          clone.removeAttribute("id");
          clone.setAttribute("aria-hidden", "true");
          if (summary && presentation && presentation.mode !== "working" && presentation.branch) clone.setAttribute("data-bb-chat-ui-branch", "");
          button.append(clone);
        }
        if (summary && item.key === "diff") {
          const count = readDiff()?.detail?.commitCount;
          if (presentation?.mode === "branch" && count != null && count > 0) {
            text.setAttribute(`${MARK}-diff-summary`, "");
            text.textContent = presentation.branchLabel;
            text.append(" · ", commitCount(count));
          }
          const ahead = text.textContent?.match(/^↑(\d+)$/);
          if (ahead) text.replaceChildren("↑", diffNumber(ahead[1], "commits"));
          const parts = text.textContent?.match(/^(\+\d+)\s*([-−]\d+)\s*·?\s*(.*)$/);
          if (parts) {
            text.replaceChildren();
            const added = document.createElement("span"); added.className = "text-diff-added"; added.append("+", diffNumber(parts[1].slice(1), "added"));
            const removed = document.createElement("span"); removed.className = "text-diff-removed"; removed.append(parts[2][0], diffNumber(parts[2].slice(1), "removed"));
            const files = parts[3].match(/^(\d+)(\s+files?)$/);
            text.append(added, " ", removed, " · ");
            if (files) text.append(diffNumber(files[1], "files"), files[2]);
            else text.append(parts[3]);
          }
        }
        button.append(text);
        if (summary && item.key === "diff") {
          if (presentation?.mode === "working" && presentation.branch) {
            const branch = emptyIcon("diff")?.cloneNode(true) as Element | undefined;
            if (branch) { branch.setAttribute("data-bb-chat-ui-branch", ""); branch.setAttribute("aria-hidden", "true"); button.append(branch); }
          } else if (!presentation) {
            const branch = item.trigger?.querySelector('[data-bb-chat-ui-branch]');
            if (branch) button.append(branch.cloneNode(true));
          }
        }
      }
      button.title = `${item.label} · ${describe(item)}${childCount ? ` · ${childCount}개` : ""}${presentation?.branch ? ` · ${presentation.branch}` : item.key === "diff" && item.trigger?.title ? ` · ${item.trigger.title}` : ""}`;
      if (summary && item.key === "status" && readOnlyLabel) button.title = readOnlyLabel;
      button.setAttribute("aria-label", button.title);
      if (roll) for (const number of Array.from(button.querySelectorAll(`[${MARK}-diff-number]`))) {
        const before = previousNumbers.get(number.getAttribute(`${MARK}-diff-number`));
        const value = number.getAttribute(`${MARK}-diff-value`)!;
        if (before == null || before === value) continue;
        const previous = document.createElement("span"); previous.setAttribute(`${MARK}-diff-value`, before);
        previous.setAttribute(`${MARK}-diff-previous`, ""); previous.setAttribute("aria-hidden", "true");
        const current = document.createElement("span"); current.textContent = value; current.setAttribute(`${MARK}-diff-current`, "");
        current.addEventListener("animationend", () => number.replaceChildren(value), { once:true });
        number.replaceChildren(current, previous);
      }
    };
    // Close the current information card and release its workflow stylesheet.
    const close = (restoreFocus = false, force = false) => {
      queueControls.close();
      cancelHover();
      if (!force && editing()) return false;
      clearTitleIcon();
      hoverPreview = false;
      const item = items.find(item => item.node === activeNode && item.key === active);
      activeNode?.removeAttribute(OPEN);
      if (workflowOwners.delete(stack) && workflowOwners.size === 0) workflowStyle.remove();
      parentArm = null;
      if (!editing() && active !== "diff" && item?.trigger?.getAttribute("aria-expanded") === "true") item.trigger.click();
      menu?.remove();
      menu = null;
      active = null;
      activeNode = null;
      syncJump();
      syncNativeControls();
      updateScrollHints();
      orb.setAttribute("aria-expanded", "false");
      for (const button of [...buttons.values(), ...stackIcons.values()]) button.setAttribute("aria-expanded", "false");
      if (restoreFocus) (lastTrigger?.isConnected && !lastTrigger.hidden ? lastTrigger : !orb.hidden ? orb : iconStack.querySelector<HTMLElement>("button") ?? [...buttons.values()].find(button=>!button.hidden))?.focus();
      return true;
    };
    const archiveAction = (item?:InfoItem) => {
      const kind = readOnlyLabel === "Archived thread" ? "unarchive" : "environment";
      const source = stack.querySelector<HTMLButtonElement>(`[${SOURCE}] [${MARK}-restore-source="${kind}"]`);
      if (source) return source;
      const label = kind === "unarchive" ? /^Unarchiv(?:e|ing[.…]*)$/i : /^(?:Restore workspace|Restoring[.…]*)$/i;
      return item && Array.from(item.node.querySelectorAll<HTMLButtonElement>("button"))
        .find(button => [button.getAttribute("aria-label"), button.textContent].some(text => label.test(text?.trim() ?? "")));
    };
    const renderArchiveRestore = (container:HTMLElement, item:InfoItem) => {
      let button = container.querySelector<HTMLButtonElement>(`[${MARK}-unarchive]`);
      if (!button) {
        button = document.createElement("button"); button.type = "button";
        button.setAttribute(`${MARK}-unarchive`, ""); button.setAttribute(cardSlot.button, "");
        button.addEventListener("click", () => archiveAction(items.find(item => item.node === activeNode && item.key === "status"))?.click());
        container.replaceChildren(button);
      }
      const source = archiveAction(item);
      const label = readOnlyLabel === "Archived thread" ? "Unarchive" : "Restore workspace";
      if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
      const text = source?.textContent?.trim() || label;
      if (button.textContent !== text) button.textContent = text;
      const disabled = !source || source.disabled || source.getAttribute("aria-disabled") === "true";
      if (button.disabled !== disabled) button.disabled = disabled;
      const error = source?.getAttribute(`${MARK}-restore-error`);
      let alert = container.querySelector<HTMLElement>('[role="alert"]');
      if (error) {
        if (!alert) { alert = document.createElement("p"); alert.setAttribute("role", "alert"); container.append(alert); }
        if (alert.textContent !== error) alert.textContent = error;
      } else alert?.remove();
    };
    const open = (key: InfoKind | "all", trigger: HTMLElement, selected?: InfoItem, preview = false) => {
      openDetail(key, trigger, selected, preview);
      syncJump();
    };
    // Open the selected information card with its styles ready before native layout.
    const openDetail = (key: InfoKind | "all", trigger: HTMLElement, selected?: InfoItem, preview = false) => {
      if (editing() || stack.hasAttribute(`${MARK}-request`)) return;
      if (key !== "all" && !listed.includes(key)) return;
      cancelHover();
      if (active === key && hoverPreview && !preview && (!selected || selected.node === activeNode)) { hoverPreview = false; return; }
      if (preview && active !== null && (!hoverPreview || active === key)) return;
      if (active === key && (!selected || selected.node === activeNode)) { close(true); return; }
      close(false, false);
      hoverPreview = preview;
      lastTrigger = trigger;
      for (const [kind, button] of stackIcons) button.setAttribute("aria-expanded", String(kind === key));
      if (key === "all") {
        active = "all";
        menu = document.createElement("section");
        menu.id = `bb-composer-info-menu-${++serial}`;
        menu.setAttribute(`${MARK}-menu`, "");
        menu.setAttribute("aria-label", "전체 정보");
        const header = createCardHead(document, { title:"전체 정보", icon:null });
        const dismiss = createCardClose(document, "전체 정보 닫기");
        dismiss.setAttribute(`${MARK}-close`, "");
        dismiss.addEventListener("click", () => close(true));
        const caption = document.createElement("p");
        caption.setAttribute(cardSlot.meta, "");
        caption.textContent = "하나를 선택해 펼치기 · 상단 표시는 Chat UI 설정에서 선택";
        const grid = document.createElement("div");
        grid.setAttribute(`${MARK}-catalog`, "");
        for (const item of catalog()) {
          const choice = document.createElement("button");
          choice.type = "button";
          choice.setAttribute(`${MARK}-choice`, item.key);
          if ("node" in item) {
            decorate(choice, item, false);
            if (items.filter(other => other.key === item.key).length > 1) choice.querySelector("span")!.textContent = `${item.label} · ${describe(item)}`;
          } else {
            choice.setAttribute(`${MARK}-unavailable`, "");
            const icon = emptyIcon(item.key)?.cloneNode(true) as Element | undefined;
            icon?.removeAttribute("id");
            icon?.setAttribute("aria-hidden", "true");
            const label = document.createElement("span"); label.textContent = item.label;
            const state = document.createElement("small"); state.textContent = "현재 없음";
            if (icon) choice.append(icon);
            choice.append(label, state);
          }
          choice.addEventListener("click", () => {
            open(item.key, orb, "node" in item ? item : undefined);
            (menu ?? activeNode)?.querySelector<HTMLElement>(`button:not([${MARK}-readonly-title]), a, input, [tabindex="0"]`)?.focus();
          });
          grid.append(choice);
        }
        menu.append(header, caption, grid, dismiss);
        bar.append(menu);
        syncTitleIcon();
        orb.setAttribute("aria-controls", menu.id);
        orb.setAttribute("aria-expanded", "true");
        updateScrollHints();
        return;
      }
      const item = selected ?? items.find(item => item.key === key);
      const archiveDetail = key === "status" && readOnlyLabel !== null;
      if (!item || key === "diff" || archiveDetail) {
        active = key;
        activeNode = item?.node ?? null;
        menu = document.createElement("section");
        menu.id = `bb-composer-info-detail-${++serial}`;
        menu.setAttribute(`${MARK}-menu`, "");
        menu.setAttribute(item ? archiveDetail ? `${MARK}-archived-detail` : `${MARK}-diff` : `${MARK}-empty`, key);
        const label = archiveDetail ? readOnlyLabel! : labelOf(key);
        menu.setAttribute("aria-label", label);
        const header = createCardHead(document, { title:label, icon:null });
        const dismiss = createCardClose(document, `${label} 닫기`);
        dismiss.setAttribute(`${MARK}-close`, "");
        dismiss.addEventListener("click", () => close(true));
        const caption = document.createElement(item ? "div" : "p");
        caption.setAttribute(cardSlot.body, "");
        if (item && archiveDetail) {
          if (!archiveAction(item) && item.trigger?.getAttribute("aria-expanded") === "false") item.trigger.click();
          renderArchiveRestore(caption, item);
        }
        else if (item) { caption.setAttribute(`${MARK}-diff-content`, ""); renderDiff(caption, item); }
        else caption.textContent = "현재 정보 없음";
        menu.append(header, caption, dismiss);
        if (item && !archiveDetail) {
          const action = panelAction("Diff 패널 열기", () => {
            const current = items.find(item => item.key === "diff");
            close();
            if (current?.trigger?.id === "thread-prompt-banner-git-toggle") current.trigger.click();
            else openChangesPanel(document, stack);
          });
          action.setAttribute(`${MARK}-action`, "diff");
          header.append(action);
        }
        buttons.get(key)?.setAttribute("aria-expanded", "true");
        bar.append(menu);
        syncTitleIcon();
        orb.setAttribute("aria-controls", menu.id);
        orb.setAttribute("aria-expanded", "true");
        updateScrollHints();
        return;
      }
      if (key === "workflow") {
        if (workflowOwners.size === 0) tailStyle.before(workflowStyle);
        workflowOwners.add(stack);
      }
      active = key;
      activeNode = item.node;
      // The value names the family, so a shared host card shows only that family.
      item.node.setAttribute(OPEN, key);
      if (key === "parent") parentArm = item.trigger;
      if (item.trigger?.getAttribute("aria-expanded") === "false") clickNativeTitle(item.trigger);
      syncNativeControls();
      syncTitleIcon();
      buttons.get(key)?.setAttribute("aria-expanded", "true");
      updateScrollHints();
    };
    const inHoverArea = (target: EventTarget | null) => target instanceof view!.Node &&
      (lastTrigger?.contains(target) || (menu ?? activeNode)?.contains(target));
    const onHoverOver = (event: PointerEvent) => {
      if (!isDesktopChrome(document) || event.pointerType !== "mouse") return;
      const button = (event.target as Element).closest<HTMLElement>(`[${MARK}-trigger], [${MARK}-stack-kind], [${MARK}-all]`);
      if (button && bar.contains(button) && !button.hidden && !bar.hidden) {
        if (event.relatedTarget instanceof view!.Node && button.contains(event.relatedTarget)) return;
        cancelHover();
        const key = button.hasAttribute(`${MARK}-all`) ? "all" : (button.getAttribute(`${MARK}-trigger`) ?? button.getAttribute(`${MARK}-stack-kind`)) as InfoKind;
        if (active === key || active !== null && !hoverPreview) return;
        hoverOpenTimer = view!.setTimeout(() => {
          hoverOpenTimer = undefined;
          if (isDesktopChrome(document) && button.isConnected && !button.hidden && !bar.hidden) open(key, button, undefined, true);
        }, 180);
      } else if (inHoverArea(event.target)) cancelHover();
    };
    const onHoverOut = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const button = (event.target as Element).closest<HTMLElement>(`[${MARK}-trigger], [${MARK}-stack-kind], [${MARK}-all]`);
      if (button && event.relatedTarget instanceof view!.Node && button.contains(event.relatedTarget)) return;
      view!.clearTimeout(hoverOpenTimer); hoverOpenTimer = undefined;
      if (!hoverPreview || inHoverArea(event.relatedTarget)) return;
      view!.clearTimeout(hoverCloseTimer);
      hoverCloseTimer = view!.setTimeout(() => { if (hoverPreview) close(); }, 150);
    };
    // Keep native disclosure focus on the hidden queue collapse control from pinning a preview.
    const pinPreview = (event: Event) => {
      if (event.type === "focusin" && active === "queue" && event.target instanceof view!.Element &&
        event.target.closest('button[aria-label="Collapse queued messages"]')) return;
      if (hoverPreview && (menu ?? activeNode)?.contains(event.target as Node)) { cancelHover(); hoverPreview = false; }
    };
    stack.addEventListener("pointerover", onHoverOver);
    stack.addEventListener("pointerout", onHoverOut);
    stack.addEventListener("pointerdown", pinPreview, true);
    stack.addEventListener("focusin", pinPreview);
    orb.addEventListener("click", () => { open("all", orb); });
    // Place information surfaces and keep a newly receiving queue destination at rest.
    const fit = (motion = true) => {
      const jumpBefore = pendingJump; pendingJump = null;
      if (jumpBefore) {
        for (const animation of entryAnimations) animation.cancel();
        entryAnimations.clear(); moves.clear(); cancelExit(); cancelStackCount();
      }
      const scale = ["device", "viewport", "hit-target"].map(key => document.documentElement.getAttribute(`data-bb-chat-ui-root-${key}`)).join(":");
      if (scale !== measuredScale) { measuredScale = scale; measuredWidths = new WeakMap(); }
      const hadStack = appeared.has("all") && !iconStack.hidden && stackIcons.size > 0;
      const previouslyVisible = new Set([...buttons.values()].filter(button => !button.hidden && positions.has(button)));
      // Reveal candidates together so width reads share one layout calculation.
      for (const button of buttons.values()) if (!measuredWidths.has(button)) button.hidden = false;
      const widths = [...buttons].map(([key, button]) => {
        // Entry transforms change visual bounds, but must not change which pills fit.
        let width = measuredWidths.get(button);
        if (width === undefined) {
          width = button.offsetWidth || button.getBoundingClientRect().width;
          // A hidden ancestor can report zero; retry when it is visible again.
          if (width > 0) measuredWidths.set(button, width);
        }
        return { key, width:widthAnimations.get(button)?.width ?? width };
      });
      for (const [key, exit] of exits) if (!buttons.has(key)) widths.push({ key, width:exit.node.offsetWidth });
      const width = stack.getBoundingClientRect().width;
      const activeKinds = new Set(items.filter(item=>item.key!=="diff" || readDiff()?.presentation?.visible!==false).map(item => item.key));
      const place = () => {
        if (readOnlyLabel) return new Set<InfoKind>(["status"]);
        let shown:Set<string> = new Set(widths.map(item=>item.key));
        for (let attempt=0; attempt<=listed.length; attempt++) {
          const folded=infoStack(listed,activeKinds,new Set([...shown].filter(key=>buttons.has(key as InfoKind))),showInactive);
          const available=width>0 ? width - (jumpVisible ? 40 : 0) - (folded.width ? folded.width + 8 : 0) : Number.POSITIVE_INFINITY;
          const next=new Set(fitComposerInfo(widths,available+40));
          if (next.size===shown.size && [...next].every(key=>shown.has(key))) break;
          shown=next;
        }
        return shown;
      };
      // Child Thread keeps three avatars when there is room, then two or one before folding.
      const childEntry = readOnlyLabel || !buttons.has("children") ? null : widths.find(item => item.key === "children");
      const childItem = items.find(item => item.key === "children");
      if (childEntry && childItem) {
        const circles = (cap: number) => Math.min(cap, childTotal) + (childTotal > cap ? 1 : 0);
        const base = childEntry.width;
        let cap = 3;
        for (; cap > 1; cap--) {
          childEntry.width = base + AVATAR_STEP * (circles(cap) - circles(avatarCap));
          if (place().has("children")) break;
        }
        childEntry.width = base + AVATAR_STEP * (circles(cap) - circles(avatarCap));
        if (cap !== avatarCap) {
          avatarCap = cap; decorate(buttons.get("children")!, childItem, true);
          measuredWidths.set(buttons.get("children")!, childEntry.width);
        }
      }
      const visible = new Set([...place()].filter(key=>buttons.has(key as InfoKind)));
      const folded = infoStack(readOnlyLabel ? [] : listed,activeKinds,visible,showInactive);
      const keep=new Set(folded.icons);
      for (const [key, node] of stackIcons) if (!keep.has(key)) {node.remove();stackIcons.delete(key);}
      folded.icons.forEach((key,index)=>{
        let node=stackIcons.get(key);
        if (!node) {node=document.createElement("button");node.type="button";node.setAttribute(`${MARK}-stack-kind`,key);node.addEventListener("click",()=>open(key,node!));stackIcons.set(key,node);}
        const item=items.find(item=>item.key===key);
        const artwork=emptyIcon(key) ?? item?.trigger?.querySelector("svg,[data-icon-root]") ?? item?.node.querySelector("svg,[data-icon-root]");
        const html=artwork?.outerHTML ?? glyph.outerHTML;
        if (node.innerHTML!==html) node.innerHTML=html;
        const label=`${labelOf(key)} · ${activeKinds.has(key)?"접힘":"현재 없음"}`;
        if(node.getAttribute("aria-label")!==label){node.setAttribute("aria-label",label);node.title=label;}
        if(node.getAttribute("aria-expanded")!==String(active===key))node.setAttribute("aria-expanded",String(active===key));node.toggleAttribute(`${MARK}-active`,activeKinds.has(key));node.style.zIndex=String(index+1);
        const at=iconStack.children[index];if(at!==node) iconStack.insertBefore(node,at??orb);
      });
      stackMore = folded.more; renderStackCount();
      orb.hidden=folded.more===0 || readOnlyLabel!==null;orb.toggleAttribute(`${MARK}-active`,folded.moreActive);orb.style.zIndex="4";
      iconStack.hidden=readOnlyLabel!==null || folded.width===0;
      for (const [key, button] of buttons) {
        if (visible.has(key)) cancelExit(key);
        else if (!jumpBefore && previouslyVisible.has(button) && !exits.has(key)) {
          leave(key, button);
        }
        button.hidden = !visible.has(key);
      }
      if (jumpBefore) {
        for (const [key, button] of buttons) if (!button.hidden) { appeared.add(key); positions.set(button, button.offsetLeft); }
        if (!iconStack.hidden) { appeared.add("all"); positions.set(iconStack, iconStack.offsetLeft); }
        jumpReflow.play(jumpBefore, jumpVisible);
        return;
      }
      // The tail follows the last pill, including the closing exit slots.
      const moving = [...buttons.values(), iconStack].filter(button => !button.hidden && !bar.hidden);
      const offsets = moving.map(button => ({ button, after:button.offsetLeft }));
      const translations = new Map(offsets.filter(({ button, after }) => positions.get(button) !== after && moves.has(button))
        .map(({ button }) => [button, parseFloat(view!.getComputedStyle(button).translate) || 0]));
      for (const { button, after } of offsets) {
        const before = positions.get(button);
        if (before !== undefined && before !== after && motion && !reduced() && !widthAnimations.size) {
          const current = translations.get(button) ?? 0;
          moves.get(button)?.cancel();
          const animation = button.animate?.([{ translate:`${before + current - after}px 0` }, { translate:"0px 0" }], { duration:280, easing:"cubic-bezier(.22,1,.36,1)" });
          if (animation) {
            moves.set(button,animation); entryAnimations.add(animation);
            animation.onfinish = animation.oncancel = () => { entryAnimations.delete(animation); if (moves.get(button) === animation) moves.delete(button); };
          }
        }
        positions.set(button,after);
      }
      for (const button of positions.keys()) if (!moving.includes(button as HTMLButtonElement)) { positions.delete(button); moves.get(button)?.cancel(); moves.delete(button); }
      if (bar.hidden || reduced()) cancelStackCount();
      if (bar.hidden) return;
      let entryDelay = 0;
      const tailFans: Animation[] = [];
      for (let button of [...Array.from(pills.children) as HTMLElement[], slot()]) {
        const key = button === slot() ? "all" : button.getAttribute(`${MARK}-trigger`) as InfoKind;
        if (button.hidden || appeared.has(key)) continue;
        appeared.add(key);
        if (queueSnapshot?.count === 0 && (key === "queue" || key === "all" && stackIcons.has("queue"))) continue;
        if (reduced()) continue;
        if (key === "all") {
          const circles = Array.from(iconStack.children).filter(node => !(node as HTMLElement).hidden) as HTMLElement[];
          const anchor = circles.at(-1);
          if (!anchor) continue;
          // One circle starts beside the last pill; the icons open and push it right.
          if (circles.length > 1) {
            const options = { duration:280 + (circles.length - 2) * 45, delay:entryDelay + 460, fill:"backwards" as FillMode, easing:"cubic-bezier(.22,1,.36,1)" };
            const growth = iconStack.animate?.([{ width:"32px" }, { width:`${iconStack.offsetWidth || 32 + (circles.length - 1) * 18}px` }], options);
            const push = anchor.animate?.([{ translate:`${-anchor.offsetLeft}px 0` }, { translate:"0px 0" }], options);
            for (const animation of [growth, push]) if (animation) { tailFans.push(animation); entryAnimations.add(animation); animation.onfinish = animation.oncancel = () => entryAnimations.delete(animation); }
          }
          for (const [index, circle] of circles.slice(0, -1).entries()) {
            const fan = circle.animate?.([
              { translate:`${-circle.offsetLeft}px 0`, opacity:0 },
              { translate:"0px 0", opacity:1 },
            ], { duration:280, delay:entryDelay + 460 + index * 45, fill:"backwards", easing:"cubic-bezier(.22,1,.36,1)" });
            if (fan) {
              tailFans.push(fan); entryAnimations.add(fan);
              let timer:number | undefined;
              if (!orb.hidden) {
                timer = view!.setTimeout(() => finishStackCount(circle, timer), entryDelay + 460 + index * 45);
                stackCountTimers.set(circle, timer);
              }
              fan.onfinish = fan.oncancel = () => { entryAnimations.delete(fan); finishStackCount(circle, timer); };
            }
          }
          renderStackCount();
          button = anchor;
        }
        if (button.querySelector(`[${MARK}-avatars]`)) {
          const avatars = button.querySelectorAll<HTMLElement>(`[${MARK}-avatar][data-new]`);
          avatars.forEach((avatar, index) => { avatar.style.animationDelay = `${entryDelay + index * 45}ms`; });
          entryDelay += Math.max(1, avatars.length) * 45;
          continue;
        }
        const animation = button.animate?.([
          { transform:"translateY(8px) scale(.82,.72)", offset:0, easing:"cubic-bezier(.36,0,.18,1)" },
          { transform:"translateY(-4px) scale(.94,1.16)", offset:.35, easing:"cubic-bezier(.36,0,.18,1)" },
          { transform:"translateY(0) scale(1.1,.94)", offset:.65, easing:"cubic-bezier(.36,0,.18,1)" },
          { transform:"translateY(-1px) scale(.985,1.015)", offset:.82, easing:"cubic-bezier(.36,0,.18,1)" },
          { transform:"none", offset:1 },
        ], { duration:460, delay:entryDelay, fill:"backwards" });
        entryDelay += 45;
        if (animation) {
          entering.add(button);
          if (key === "all") entering.add(iconStack);
          entryAnimations.add(animation);
          animation.onfinish = animation.oncancel = () => { entryAnimations.delete(animation); entering.delete(button); if (key === "all") entering.delete(iconStack); };
        }
      }
    };
    let resizeWidth: number | undefined;
    // Refit width changes while keeping open-card scroll edges aligned on height changes.
    const resize = typeof view!.ResizeObserver === "function" ? new view!.ResizeObserver(entries => {
      const width = entries?.find(entry => entry.target === stack)?.contentRect.width;
      if (width !== undefined && width === resizeWidth) { updateScrollHints(); return; }
      if (width === undefined || width !== resizeWidth) measuredWidths = new WeakMap();
      resizeWidth = width;
      fit();
    }) : null;
    resize?.observe(stack);
    // Secret shells change height in the same commit that hides the body. Cache the
    // resting box and animate before paint; the shared rAF sync would already be the snapped frame.
    const SECRET_FORM = 'form[class~="@container/secrets"]';
    const secretHeights = new WeakMap<HTMLElement, number>();
    const secretExpanded = new WeakMap<HTMLElement, boolean>();
    const secretHidden = new Map<HTMLElement, { node: HTMLElement; hidden: boolean; display: boolean }[]>();
    const secretStyled = new WeakSet<HTMLElement>();
    let secretObserver: MutationObserver | null = null;
    const secretBox = (shell: HTMLElement) => shell.getBoundingClientRect().height;
    const rememberSecret = (shell: HTMLElement) => {
      if (secretMotions.has(shell)) return;
      const height = secretBox(shell);
      if (height > 0) secretHeights.set(shell, height);
    };
    const disclosureOf = (shell: HTMLElement) => {
      const id = shell.querySelector("button[aria-controls]")?.getAttribute("aria-controls");
      if (!id) return null;
      const node = shell.ownerDocument.getElementById(id);
      return node && shell.contains(node) ? node : null;
    };
    const claimHidden = (shell: HTMLElement) => {
      const found: { node: HTMLElement; hidden: boolean; display: boolean }[] = [];
      // Request cards contain their own hidden controls. Only the disclosure Activity hides is painted.
      const candidates = shell.matches(REQUEST_SHELL)
        ? [disclosureOf(shell)].filter((node): node is HTMLElement => node !== null)
        : Array.from(shell.querySelectorAll<HTMLElement>("*"));
      for (const node of candidates) {
        const hidden = node.hidden;
        const display = node.style.display === "none" && node.style.getPropertyPriority("display") === "important";
        if (!hidden && !display) continue;
        // Tailwind's layered [hidden] rule beats an author display override, so lift the attribute.
        if (hidden) node.hidden = false;
        if (display) node.style.removeProperty("display");
        found.push({ node, hidden, display });
      }
      if (found.length) secretHidden.set(shell, [...secretHidden.get(shell) ?? [], ...found]);
    };
    const restoreSecret = (shell: HTMLElement) => {
      const nodes = secretHidden.get(shell);
      secretHidden.delete(shell);
      if (!nodes || shell.hasAttribute("data-expanded")) return;
      for (const record of nodes) {
        if (record.display) record.node.style.setProperty("display", "none", "important");
        if (record.hidden) record.node.hidden = true;
      }
    };
    const dropSecretMotion = (shell: HTMLElement) => {
      const animation = secretMotions.get(shell);
      if (animation) {
        animation.onfinish = animation.oncancel = null;
        secretMotions.delete(shell);
        entryAnimations.delete(animation);
        animation.cancel();
      }
      if (shell.hasAttribute("data-expanded")) secretHidden.delete(shell);
      else restoreSecret(shell);
      secretStyled.delete(shell);
      updateScrollHints();
    };
    const finishSecret = (shell: HTMLElement, animation: Animation) => {
      if (secretMotions.get(shell) !== animation) return;
      if (shell.hasAttribute("data-expanded")) secretHidden.delete(shell);
      else restoreSecret(shell);
      animation.onfinish = animation.oncancel = null;
      secretMotions.delete(shell);
      entryAnimations.delete(animation);
      animation.cancel();
      rememberSecret(shell);
      updateScrollHints();
    };
    const animateSecret = (shell: HTMLElement, expanded: boolean) => {
      const previous = secretMotions.get(shell);
      const from = previous ? secretBox(shell) : secretHeights.get(shell) ?? secretBox(shell);
      if (previous) {
        previous.onfinish = previous.oncancel = null;
        secretMotions.delete(shell);
        entryAnimations.delete(previous);
        previous.cancel();
      }
      const to = secretBox(shell);
      if (reduced() || Math.abs(from - to) < 1 || !shell.animate) {
        if (expanded) secretHidden.delete(shell);
        else restoreSecret(shell);
        rememberSecret(shell);
        updateScrollHints();
        return;
      }
      if (expanded) secretHidden.delete(shell);
      else claimHidden(shell);
      const animation = shell.animate([{ height:`${from}px` }, { height:`${to}px` }], { duration:320, easing:"cubic-bezier(.22,1,.36,1)", fill:"both" });
      secretMotions.set(shell, animation);
      entryAnimations.add(animation);
      animation.finished?.catch(() => {});
      animation.onfinish = animation.oncancel = () => finishSecret(shell, animation);
      updateScrollHints();
    };
    const trackSecretShell = (shell: HTMLElement) => {
      const request = shell.matches(REQUEST_SHELL);
      if (!shell.isConnected || (!request && !shell.hasAttribute(`${MARK}-secret`) && !shell.querySelector(SECRET_FORM))) return;
      if (!request) shell.setAttribute(`${MARK}-secret`, "");
      if (secretObserver && !secretStyled.has(shell)) {
        secretStyled.add(shell);
        secretObserver.observe(shell, { subtree:true, attributes:true, attributeFilter:["style"] });
      }
      const expanded = shell.hasAttribute("data-expanded");
      const known = secretExpanded.get(shell);
      if (known === undefined) {
        secretExpanded.set(shell, expanded);
        rememberSecret(shell);
        return;
      }
      if (known === expanded) {
        if (!expanded && secretMotions.has(shell)) claimHidden(shell);
        rememberSecret(shell);
        return;
      }
      secretExpanded.set(shell, expanded);
      animateSecret(shell, expanded);
    };
    const shellsIn = (node: Node) => {
      if (node.nodeType !== 1) return [] as HTMLElement[];
      const element = node as HTMLElement;
      const found = element.matches(HEIGHT_SHELL) ? [element] : [];
      for (const shell of Array.from(element.querySelectorAll<HTMLElement>(HEIGHT_SHELL))) found.push(shell);
      return found;
    };
    const trackSecrets = () => {
      for (const shell of Array.from(stack.querySelectorAll<HTMLElement>(HEIGHT_SHELL))) trackSecretShell(shell);
      for (const shell of secretMotions.keys()) if (!shell.isConnected) dropSecretMotion(shell);
    };
    const releaseSecrets = () => {
      secretObserver?.disconnect();
      secretObserver = null;
      const shells = new Set<HTMLElement>(secretMotions.keys());
      for (const shell of Array.from(stack.querySelectorAll<HTMLElement>(`[${MARK}-secret]`))) shells.add(shell);
      for (const shell of shells) {
        dropSecretMotion(shell);
        shell.removeAttribute(`${MARK}-secret`);
      }
      secretMotions.clear();
    };
    secretObserver = new view!.MutationObserver(records => {
      const shells = new Set<HTMLElement>();
      for (const record of records) {
        const target = record.target.nodeType === 1 ? record.target as HTMLElement : record.target.parentElement;
        const shell = target?.closest<HTMLElement>(HEIGHT_SHELL) ?? null;
        if (shell) shells.add(shell);
        if (record.type === "childList") for (const node of [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]) for (const nested of shellsIn(node)) shells.add(nested);
      }
      for (const shell of shells) trackSecretShell(shell);
      for (const shell of secretMotions.keys()) if (!shell.isConnected) dropSecretMotion(shell);
    });
    secretObserver.observe(stack, { childList:true, subtree:true, attributes:true, attributeFilter:["data-expanded", "hidden"] });
    let suspended = false;
    let fitSignature = "";
    // Fit only changed pill content, membership, artwork, or layout inputs, not detail revisions.
    const currentFitSignature = () => JSON.stringify([threadId, bar.hidden, readOnlyLabel, jumpVisible, reduced(),
      listed, showInactive, items.filter(item => item.key !== "diff" || readDiff()?.presentation?.visible !== false).map(item => item.key),
      [...buttons].map(([key, button]) => [key, buttonContent.get(button)]),
      // Match the artwork fallback used when rendering catalog-only folded icons.
      listed.map(key => {
        const item = items.find(item => item.key === key);
        return (emptyIcon(key) ?? item?.trigger?.querySelector("svg,[data-icon-root]") ?? item?.node.querySelector("svg,[data-icon-root]"))?.outerHTML;
      }),
      ...["device", "viewport", "hit-target"].map(key => document.documentElement.getAttribute(`data-bb-chat-ui-root-${key}`))]);
    const sync = () => {
      pruneDisconnected();
      const source = stack.querySelector(`[${SOURCE}]`);
      if (source !== watchedSource) {
        sourceWatch.disconnect();
        watchedSource = source;
        // Provider artwork can change only its mask/class on the hidden SDK source.
        if (source) sourceWatch.observe(source, { attributes:true, subtree:true });
      }
      if (!source) {
        stack.toggleAttribute(`${MARK}-request`, stack.querySelector(REQUEST) !== null);
        if (!suspended) {
          suspended = true; bar.inert = true; bar.setAttribute("aria-hidden", "true");
          cancelStackCount(); cancelQueueMotion(); cancelOwnedMotion(); queueSnapshot = null;
          cancelExit(); close(false, true);
          for (const animation of entryAnimations) animation.cancel();
          entryAnimations.clear();
        }
        return;
      }
      if (suspended) {
        suspended = false; bar.inert = false; bar.removeAttribute("aria-hidden");
        signature = "";
      }
      const nextThreadId = source.getAttribute(`${MARK}-thread`);
      if (nextThreadId !== threadId) {
        cancelStackCount(); cancelQueueMotion(); cancelOwnedMotion(); queueSnapshot = null;
        cancelExit(); positions.clear(); moves.clear();
        close(false, true);
        for (const animation of entryAnimations) animation.cancel();
        entryAnimations.clear(); widthAnimations.clear(); entering.clear(); appeared.clear(); childStates.clear();
        for (const button of buttons.values()) { buttonContent.delete(button); diffHopContent.delete(button); }
        signature = ""; threadId = nextThreadId;
      }
      const feedback = emptyIcon("annotations");
      if (feedback) {
        const mask = `url("data:image/svg+xml,${encodeURIComponent(new view!.XMLSerializer().serializeToString(feedback))}")`;
        if (stack.style.getPropertyValue("--bb-chat-ui-feedback-icon") !== mask) stack.style.setProperty("--bb-chat-ui-feedback-icon", mask);
      }
      const found: InfoItem[] = [];
      const currentOwned = new Set<HTMLElement>();
      const currentWrappers = new Set<HTMLElement>();
      const walk = (node: HTMLElement) => {
        if (node === bar || node.hidden || node.matches(`${REQUEST}, ${WORKFLOW_COLLAPSE}`) || node.matches("section") && node.querySelector(REQUEST)) return;
        if (node.matches(NATIVE)) {
          mark(node, UNIT, currentOwned);
          for (const key of kindsOf(node)) found.push({ key, node, trigger:nativeTrigger(node, key), label:labelOf(key) });
        } else if (node.querySelector(`${NATIVE}, ${REQUEST}, [${SOURCE}], [${MARK}-supplements]`)) {
          mark(node, WRAP, currentWrappers);
          for (const child of Array.from(node.children)) walk(child as HTMLElement);
        } else if (node.textContent?.trim() || node.querySelector("img, button")) {
          mark(node, UNIT, currentOwned);
          found.push({ key:"other", node, trigger:nativeTrigger(node, "other"), label:node.getAttribute("aria-label") || "플러그인 정보" });
        }
      };
      for (const child of Array.from(stack.children)) walk(child as HTMLElement);
      for (const node of owned) if (!currentOwned.has(node)) { node.removeAttribute(UNIT); node.removeAttribute(OPEN); }
      for (const node of wrappers) if (!currentWrappers.has(node)) node.removeAttribute(WRAP);
      owned.clear(); currentOwned.forEach(node => owned.add(node));
      wrappers.clear(); currentWrappers.forEach(node => wrappers.add(node));
      // Child rows use the SDK design; other families keep their native editable controls.
      const hasChildRows = found.some(item => item.key === "children" && item.node.hasAttribute(`${MARK}-kind`));
      const native = found.filter(item => !item.node.hasAttribute(`${MARK}-kind`) && !(hasChildRows && item.key === "children"));
      items = [...native, ...found.filter(item => item.node.hasAttribute(`${MARK}-kind`) && !native.some(other => other.key === item.key))];
      const status = items.find(item => item.key === "status");
      const unavailable = status && (status.node.matches(UNAVAILABLE) ? status.node : status.node.querySelector(UNAVAILABLE));
      // The native card disappears first after restore; its old SDK snapshot must not leave an empty read-only row.
      const nextReadOnlyLabel = status ? source.getAttribute(`${MARK}-read-only-label`) ?? (status.node.matches(ARCHIVED) || status.node.querySelector(ARCHIVED) ? "Archived thread" : unavailable?.getAttribute("aria-label") ?? null) : null;
      if (readOnlyLabel !== nextReadOnlyLabel) { readOnlyLabel = nextReadOnlyLabel; cancelQueueMotion(); cancelExit(); close(false, true); }
      bar.toggleAttribute(`${MARK}-archived`, readOnlyLabel !== null);
      iconStack.hidden = readOnlyLabel !== null;
      syncPanelActions();
      if (!items.some(item => item.key === "diff")) {
        try {
          const summary = readDiff();
          if (awaitingDiff() || summary && Number.isFinite(summary.files) && Number.isFinite(summary.insertions) && Number.isFinite(summary.deletions)) {
            if (!diffSupplement) {
              diffSupplement = document.createElement("section");
              diffSupplement.setAttribute(UNIT, "");
              const button = document.createElement("button");
              button.type = "button";
              diffSupplement.append(button);
              bar.append(diffSupplement);
            }
            const button = diffSupplement.querySelector("button")!;
            const text = awaitingDiff() || !summary ? "불러오는 중" : summary.presentation?.label ?? `+${summary.insertions} −${summary.deletions} · ${summary.files} files`;
            if (button.textContent !== text) button.textContent = text;
            const title = summary?.branch ?? "Code Diff";
            if (button.title !== title) button.title = title;
            items.unshift({ key:"diff", node:diffSupplement, trigger:button, label:"Code Diff" });
          }
        } catch { /* A disconnected environment has no invented Diff tally. */ }
      }
      const request = stack.querySelector(REQUEST) !== null;
      if (request !== stack.hasAttribute(`${MARK}-request`)) stack.toggleAttribute(`${MARK}-request`, request);
      if (request || activeNode && !items.some(item => item.node === activeNode)) close(false, true);
      if (active === "parent" && activeNode?.getAttribute(OPEN) === "parent") {
        const trigger = items.find(item => item.node === activeNode && item.key === "parent")?.trigger;
        if (trigger && trigger.getAttribute("aria-expanded") === "false" && trigger !== parentArm) {
          parentArm = trigger;
          trigger.click();
        }
      }
      syncNativeControls();
      syncTitleIcon();
      if (active === "status" && menu?.hasAttribute(`${MARK}-archived-detail`)) {
        const item = items.find(item => item.node === activeNode && item.key === "status");
        if (item) renderArchiveRestore(menu.querySelector("div")!, item);
      }
      const data = readInfoData(source);
      const settings = data?.value.settings ?? {};
      listed = listedInfo(settings);
      showInactive = settings.showInactiveInfo === true;
      if (readOnlyLabel && !listed.includes("status")) listed.push("status");
      if (active && active !== "all" && !listed.includes(active)) close();
      if (active && active !== "all" && !showInactive && !items.some(item => item.key === active && (item.key !== "diff" || readDiff()?.presentation?.visible !== false))) close();
      if (active === "all" && !showInactive && !catalog().length) close();
      if (!listed.length) close();
      bar.hidden = request || !listed.length && !editing();
      syncJump();
      if (!showInactive && !jumpVisible && !editing() && !items.some(item => listed.includes(item.key) && (item.key !== "diff" || readDiff()?.presentation?.visible !== false))) bar.hidden = true;
      const diff = readDiff();
      const unavailableDiff = diffData()?.value.state === "unavailable";
      const exposed: InfoKind[] = readOnlyLabel ? ["status"] : exposedInfo(settings).filter(key => key !== "diff" || !unavailableDiff && diff?.presentation?.visible !== false);
      if (request || reduced() || bar.hidden) { cancelExit(); cancelOwnedMotion(); }
      if (active === "annotations" && items.find(item => item.node === activeNode && item.key === active)?.trigger?.getAttribute("aria-expanded") === "false") close(true);
      const childIcons = Array.from(source.querySelectorAll(`[${MARK}-child-icon]`)).map(node => node.outerHTML);
      const next = JSON.stringify([settings, readOnlyLabel, infoKinds.map(kind => emptyIcon(kind.key)?.outerHTML), childIcons, items.map(item => [item.key, describe(item)]), data?.revision, diffData()?.revision, unavailableDiff, stack.style.getPropertyValue("--bb-chat-ui-feedback-icon")]);
      let widthChange: { button:HTMLButtonElement; from:number } | null = null;
      let hopTargets: HTMLElement[] = [];
      const stackContent = () => JSON.stringify(Array.from(iconStack.children).map(node => [node.getAttribute("aria-label"), node.hasAttribute(`${MARK}-active`), node.innerHTML]));
      const previousSlot = stackContent();
      let signatureChanged = false;
      if (signature !== next) {
        // An interrupted width animation starts at its current visual width,
        // rather than the cached resting target. Read before decorating any pill.
        const animatedWidths = new Map([...widthAnimations.keys()].map(button =>
          [button, button.offsetWidth || button.getBoundingClientRect().width]));
        signatureChanged = signature !== "";
        signature = next;
        for (const [key, button] of buttons) if (!exposed.includes(key) || !items.some(item => item.key === key)) {
          if (!readOnlyLabel) {
            leave(key, button);
          }
          widthAnimations.get(button)?.animation.cancel();
          button.remove(); buttons.delete(key);
        }
        for (const key of exposed) {
          const item = items.find(item => item.key === key);
          if (!item) continue;
          cancelExit(key);
          let button = buttons.get(key);
          if (!button) {
            button = document.createElement("button");
            button.type = "button";
            button.setAttribute(`${MARK}-trigger`, key);
            button.addEventListener("click", () => { open(key, button!); });
            buttons.set(key, button);
          }
          const previousText = button.textContent;
          const previousWidth = key === "diff" ? animatedWidths.get(button) ?? measuredWidths.get(button) ?? 0 : 0;
          const wasVisible = button.isConnected && !button.hidden && !bar.hidden && appeared.has(key);
          button.setAttribute("aria-expanded", String(active === key));
          button.removeAttribute(`${MARK}-unavailable`);
          const content = JSON.stringify([item ? describe(item) : null, item?.trigger?.title,
            key === "status" ? readOnlyLabel : null,
            emptyIcon(key)?.outerHTML ?? item?.trigger?.querySelector("svg, [data-icon-root]")?.outerHTML ?? item?.node.querySelector("svg, [data-icon-root]")?.outerHTML,
            key === "children" ? data?.childrenRevision : null,
            key === "children" ? childIcons : null,
            key === "diff" ? [diff?.presentation, diff?.detail?.commitCount] : null]);
          const previousContent = buttonContent.get(button);
          if (previousContent !== content) {
            buttonContent.set(button, content);
            measuredWidths.delete(button);
            decorate(button, item, true);
            let changedBeyondNumbers = true;
            if (key === "diff") {
              const copy = button.cloneNode(true) as HTMLElement;
              for (const number of Array.from(copy.querySelectorAll(`[${MARK}-diff-number]`))) {
                number.removeAttribute(`${MARK}-diff-value`);
                number.replaceChildren("#");
                if (number.getAttribute(`${MARK}-diff-number`) === "files" && number.nextSibling?.nodeType === 3)
                  number.nextSibling.textContent = number.nextSibling.textContent?.replace(/\bfiles?\b/, "files") ?? "";
              }
              for (const count of Array.from(copy.querySelectorAll(`[${MARK}-commit-count]`))) count.removeAttribute("aria-label");
              const hopContent = JSON.stringify([copy.innerHTML, diff?.presentation?.branch ?? item?.trigger?.title]);
              changedBeyondNumbers = diffHopContent.get(button) !== hopContent;
              diffHopContent.set(button, hopContent);
            }
            if (changedBeyondNumbers && signatureChanged && previousContent !== undefined && wasVisible && !entering.has(button)) hopTargets.push(button);
          }
          const order = exposed.filter(kind => buttons.has(kind));
          const nextButton = Array.from(pills.children).filter(node => !node.hasAttribute(`${MARK}-exiting`))[order.indexOf(key)];
          if (nextButton !== button) pills.insertBefore(button, nextButton ?? null);
          if (key === "diff" && previousText !== button.textContent) {
            widthAnimations.get(button)?.animation.cancel(); widthAnimations.delete(button);
            if (wasVisible && previousWidth > 0 && !reduced()) widthChange = { button, from:previousWidth };
          }
        }
        if (active === "all") { close(); open("all", orb); }
        else if (active === "diff" && menu?.hasAttribute(`${MARK}-diff`)) {
          const item = items.find(item => item.key === "diff");
          if (item) renderDiff(menu.querySelector(`[${MARK}-diff-content]`)!, item);
        }
        else if (active && !activeNode && items.some(item => item.key === active)) {
          const key = active;
          close(); open(key, orb);
          (bar.querySelector<HTMLElement>(`[${MARK}-menu]`) ?? stack.querySelector<HTMLElement>(`[${OPEN}]`))?.querySelector<HTMLElement>('button, a, input, [tabindex="0"]')?.focus();
        }
        catalogCount = catalog().length;
      }
      const nextFit = currentFitSignature();
      if (fitSignature !== nextFit) { fitSignature = nextFit; fit(!widthChange); }
      const queue = items.find(item => item.key === "queue");
      if (queue) {
        const ids = new Set(Array.from(queue.node.querySelectorAll('[data-queued-message-id]')).map(row => row.getAttribute('data-queued-message-id')!));
        const countText = queueCount(queue) || queue.trigger?.textContent?.trim() || "";
        const previousQueue = queueSnapshot;
        const count = /^\d+$/.test(countText) ? Number(countText) : previousQueue?.count ?? ids.size;
        const newIds = previousQueue && (previousQueue.seenIds.size || previousQueue.count === 0)
          ? [...ids].filter(id => !previousQueue.seenIds.has(id)).length : 0;
        const growth = previousQueue ? Math.max(0,count - previousQueue.count) : 0;
        const rowCredit = Math.min(previousQueue?.pendingRows ?? 0,newIds);
        const countCredit = Math.min(previousQueue?.pendingCount ?? 0,growth);
        const rowArrivals = newIds - rowCredit, countArrivals = growth - countCredit;
        const complete = ids.size > 0 && ids.size === count;
        // A complete list identifies real arrivals even if its counter was reset
        // during a remount. Previously seen rows are not new sends.
        const added = complete && previousQueue?.seenIds.size ? rowArrivals : Math.max(rowArrivals,countArrivals);
        queueSnapshot = { count, seenIds:new Set([...(previousQueue?.seenIds ?? []), ...ids]),
          // Retain counterpart credit while rows are temporarily unmounted.
          pendingRows:complete ? 0 : Math.max(0,(previousQueue?.pendingRows ?? 0) - rowCredit) + Math.max(0,countArrivals - rowArrivals),
          pendingCount:complete ? 0 : Math.max(0,(previousQueue?.pendingCount ?? 0) - countCredit) + Math.max(0,rowArrivals - countArrivals),
        };
        if (readOnlyLabel || !listed.includes("queue") || bar.hidden) cancelQueueMotion();
        else for (let index = 0; index < added; index++) queueAddition(index * 45);
        if (added > 0) hopTargets = hopTargets.filter(button => button !== buttons.get("queue"));
      } else {
        // Native rendering can briefly remove the whole queue. Keep its arrival
        // history rather than treating all restored messages as additions.
        queueSnapshot ??= { count:0, seenIds:new Set(), pendingRows:0, pendingCount:0 };
        cancelQueueMotion();
      }
      const slotNow = stackContent();
      if (signatureChanged && previousSlot !== slotNow && !entering.has(slot())) hopTargets.push(slot());
      if (signatureChanged && !reduced() && !bar.hidden) for (const button of hopTargets) {
        if (!button.isConnected || button.hidden || entering.has(button)) continue;
        forgetMotion(button);
        const done = remember(button);
        eventHop(button);
        done();
      }
      if (widthChange && !widthChange.button.hidden) {
        const { button, from } = widthChange;
        const width = button.offsetWidth || button.getBoundingClientRect().width;
        if (width > 0 && width !== from) {
          const animation = button.animate?.([{ width:`${from}px` }, { width:`${width}px` }], { duration:320, easing:"cubic-bezier(.22,1,.36,1)" });
          if (animation) {
            button.setAttribute(`${MARK}-resizing`, "");
            widthAnimations.set(button, { animation, width }); entryAnimations.add(animation);
            animation.onfinish = animation.oncancel = () => {
              entryAnimations.delete(animation);
              if (widthAnimations.get(button)?.animation === animation) {
                widthAnimations.delete(button); button.removeAttribute(`${MARK}-resizing`);
                fit(false);
              }
            };
            const text = button.querySelector<HTMLElement>(":scope > span");
            const reveal = text?.animate?.([{ opacity:0, transform:"translateY(2px)" }, { opacity:1, transform:"none" }], { duration:240, easing:"ease-out" });
            if (reveal) { entryAnimations.add(reveal); reveal.onfinish = reveal.oncancel = () => entryAnimations.delete(reveal); }
          }
        }
      }
      updateScrollHints();
      trackSecrets();
      guardShell(stack.closest("[data-promptbox-shell]"));
      prMerge.sync();
      queueControls.sync();
    };
    return { sync, fit, invalidateFit() { fitSignature = ""; measuredWidths = new WeakMap(); }, refreshCard:updateScrollHints, bar, close, editing, resize, cleanup() {
      prMerge.cleanup();
      queueControls.cleanup();
      document.removeEventListener("pointerup", releasePress);
      document.removeEventListener("pointercancel", cancelPress);
      view!.removeEventListener("blur", cancelPress);
      releaseSecrets();
      cancelStackCount();
      clearTitleIcon();
      cancelQueueMotion();
      cancelOwnedMotion();
      cancelExit(); positions.clear(); moves.clear();
      close(false, true);
      for (const animation of entryAnimations) animation.cancel();
      entryAnimations.clear();
      resize?.disconnect();
      edgeResize?.disconnect();
      jumpWatch.disconnect();
      sourceWatch.disconnect();
      stack.removeEventListener("click", blockTitleActivation, true);
      stack.removeEventListener("keydown", blockTitleActivation, true);
      for (const title of readOnlyTitles.keys()) restoreTitle(title);
      for (const button of machineRetrySlots) button.removeAttribute(cardSlot.button);
      machineRetrySlots.clear();
      jumpSource?.removeAttribute(`${MARK}-jump-source`);
      stack.removeEventListener("scroll", updateScrollHints, true);
      stack.removeEventListener("animationend", updateScrollHints, true);
      stack.removeEventListener("animationcancel", updateScrollHints, true);
      stack.removeEventListener("wheel", onWheel);
      stack.removeEventListener("touchstart", onTouchStart);
      stack.removeEventListener("touchmove", onTouchMove);
      stack.removeEventListener("touchend", endTouch);
      stack.removeEventListener("touchcancel", endTouch);
      stack.removeEventListener("pointerover", onHoverOver);
      stack.removeEventListener("pointerout", onHoverOut);
      stack.removeEventListener("pointerdown", pinPreview, true);
      stack.removeEventListener("focusin", pinPreview);
      for (const pair of bodyFades.values()) { pair.above.remove(); pair.below.remove(); }
      bodyFades.clear();
      bar.remove();
      stack.removeAttribute(`${MARK}-stack`);
      stack.removeAttribute(`${MARK}-request`);
      stack.style.removeProperty("--bb-chat-ui-feedback-icon");
      for (const [source, action] of panelActions) { action.remove(); source.removeAttribute(`${MARK}-panel-source`); }
      for (const heading of panelHeadings) heading.removeAttribute(`${MARK}-panel-heading`);
      for (const heading of generatedHeadings) heading.remove();
      for (const button of nativeDismisses.values()) button.remove();
      for (const button of bulkActions.keys()) restoreBulkAction(button);
      for (const [host, row] of parentRows) { row.remove(); clearParentMarks(host); }
      for (const row of collapseRows) row.removeAttribute(`${MARK}-collapse`);
      for (const heading of closeHeadings.keys()) heading.removeAttribute(`${MARK}-close-heading`);
      for (const heading of addedHeadSlots) heading.removeAttribute(cardSlot.head);
      for (const heading of generatedCloseHeadings) heading.remove();
      for (const card of prSingleRows) card.removeAttribute(cardSlot.layout);
      clearPrHeader();
      for (const node of endActions.keys()) node.removeAttribute(cardSlot.endAction);
      for (const node of actionLayouts.keys()) restoreActionLayout(node);
      backgroundAccordions.stop();
      for (const node of owned) { node.removeAttribute(UNIT); node.removeAttribute(OPEN); }
      for (const node of wrappers) node.removeAttribute(WRAP);
    } };
  }
  function sync() {
    frame = 0;
    if (disposed) return;
    for (const [stack, state] of states) if (!stack.isConnected) { state.cleanup(); states.delete(stack); }
    if (discover) {
      discover = false;
      for (const stack of Array.from(document.querySelectorAll<HTMLElement>(STACK))) {
        if (states.has(stack) || !stack.querySelector(`[${SOURCE}]`)) continue;
        states.set(stack, mount(stack));
        dataDirty.add(stack);
      }
    }
    const data = new Set(dataDirty), widths = new Set(widthDirty), cards = new Set(cardDirty);
    dataDirty.clear(); widthDirty.clear(); cardDirty.clear();
    for (const [stack, state] of states) {
      if (widths.has(stack)) state.invalidateFit();
      if (data.has(stack)) state.sync();
      else {
        if (widths.has(stack)) state.fit();
        if (cards.has(stack)) state.refreshCard();
      }
    }
  }
  const schedule = (target?: Element, geometry = false, card = false) => {
    if (disposed) return;
    const shell = target?.closest("[data-promptbox-shell]");
    for (const stack of states.keys()) if (!shell || stack.closest("[data-promptbox-shell]") === shell) {
      (card ? cardDirty : geometry ? widthDirty : dataDirty).add(stack);
    }
    if (!frame) frame = view.requestAnimationFrame(sync);
  };
  const onResize = () => schedule(undefined, true);
  const onData = (event: Event) => {
    const target = event.target as Element;
    if (target?.closest?.("[data-promptbox-shell]")) schedule(target);
  };
  document.addEventListener(composerDataChanged, onData);
  const discovery = `[data-promptbox-shell], [data-bb-chat-ui-device], ${HOST_JUMP}`;
  const discoversInfo = (node: Node) => node instanceof view.Element &&
    (node.matches(discovery) || !!node.querySelector(discovery));
  // Pending-card guard markers replace `:has([SOURCE])` / `:has(REQUEST)` in the CSS. They are written
  // synchronously in the observer callbacks (before paint), so unclassified native cards still never flash.
  const GUARD = `${MARK}-guard`, HOLDS_REQUEST = `${MARK}-holds-request`;
  const QUEUE_COLLAPSE_WRAP = `${MARK}-queue-collapse-wrap`, COLLAPSED_INTERACTION = `${MARK}-collapsed-interaction`;
  const guardNames = [GUARD, HOLDS_REQUEST, QUEUE_COLLAPSE_WRAP, COLLAPSED_INTERACTION, `${MARK}-secret-form`];
  const guardedNodes = new Set<Element>();
  const toggleMark = (node: Element, name: string, on: boolean) => {
    if (node.hasAttribute(name) !== on) node.toggleAttribute(name, on);
    if (on) guardedNodes.add(node);
  };
  const releaseGuards = (node: Element) => {
    for (const name of guardNames) node.removeAttribute(name);
    guardedNodes.delete(node);
  };
  const releaseDetachedGuards = () => {
    for (const node of guardedNodes) if (!node.isConnected) releaseGuards(node);
  };
  const guardStack = (stack: Element) => {
    toggleMark(stack, GUARD, stack.querySelector(`[${SOURCE}]`) !== null);
    const holders = new Set<Element>();
    for (const request of Array.from(stack.querySelectorAll(REQUEST))) {
      for (let node = request.parentElement; node && node !== stack; node = node.parentElement) holders.add(node);
    }
    for (const node of Array.from(stack.querySelectorAll(`[${HOLDS_REQUEST}]`))) if (!holders.has(node)) toggleMark(node, HOLDS_REQUEST, false);
    for (const node of holders) toggleMark(node, HOLDS_REQUEST, true);
    const collapseWrappers = new Set<Element>();
    for (const queue of Array.from(stack.querySelectorAll('section[aria-label="Queued messages"]'))) {
      for (const child of Array.from(queue.children)) if (child.tagName === "DIV" && child.querySelector(':scope > button[aria-label="Collapse queued messages"]')) collapseWrappers.add(child);
    }
    for (const node of Array.from(stack.querySelectorAll(`[${QUEUE_COLLAPSE_WRAP}]`))) if (!collapseWrappers.has(node)) toggleMark(node, QUEUE_COLLAPSE_WRAP, false);
    for (const node of collapseWrappers) toggleMark(node, QUEUE_COLLAPSE_WRAP, true);
  };
  const guardShell = (shell: Element | null | undefined) => {
    releaseDetachedGuards();
    if (!shell) return;
    toggleMark(shell, COLLAPSED_INTERACTION, shell.querySelector('[data-testid="plugin-interaction-shell"]:not([data-expanded])') !== null);
    for (const card of Array.from(shell.querySelectorAll('[data-testid="plugin-interaction-shell"]'))) {
      toggleMark(card, `${MARK}-secret-form`, card.querySelector('form[class~="@container/secrets"]') !== null);
    }
    const stack = shell.querySelector(":scope > .grid");
    if (stack) guardStack(stack);
  };
  // Draft text has no information dependency. Do not ignore shell replacements,
  // handoff controls, queued editors or Secret/interaction forms around it.
  const draftMutation = (target: Element | null) => !!target?.closest(
    '[data-promptbox-editor-content], [data-follow-up-composer] textarea, [data-follow-up-composer] .ProseMirror',
  ) && !target.closest(`${STACK}, [data-testid="plugin-interaction-shell"]`);
  const cardProseMutation = (record: MutationRecord, target: Element | null) =>
    record.type !== "attributes" && !!target?.closest(`p`)
    && !!target.closest(`[${OPEN}="goal"], [${OPEN}="plan"]`)
    && !target.closest("button, a, input, textarea, [contenteditable]")
    && [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].every(node => node.nodeType === view.Node.TEXT_NODE);
  // Composer details (text, labels, attributes) are only observed inside composer shells.
  const shellObserver = new view.MutationObserver(records => {
    const shells = new Set<Element>();
    for (const record of records) {
      const target = record.target instanceof view.Element ? record.target : record.target.parentElement;
      if (record.attributeName === "class" && !target?.matches('form')) continue;
      if (target?.closest(`[${MARK}-bar]`) || draftMutation(target) || cardProseMutation(record, target)) continue;
      const shell = target?.closest("[data-promptbox-shell]");
      if (shell) shells.add(shell);
    }
    for (const shell of shells) guardShell(shell);
    for (const record of records) {
      if (record.attributeName === "data-expanded" || record.attributeName === "class") continue;
      const target = record.target instanceof view.Element ? record.target : record.target.parentElement;
      // Counts, labels and popover markup in our bar are output.
      if (target && !target.closest(`[${MARK}-bar]`) && !draftMutation(target)) schedule(target, false, cardProseMutation(record, target));
    }
  });
  const watchedShells = new Set<Element>();
  const watchShells = () => {
    releaseDetachedGuards();
    if (Array.from(watchedShells).some(shell => !shell.isConnected)) {
      shellObserver.disconnect();
      for (const shell of watchedShells) if (!shell.isConnected) {
        for (const node of [shell, ...Array.from(shell.querySelectorAll(guardNames.map(name => `[${name}]`).join(",")))]) releaseGuards(node);
      }
      watchedShells.clear();
    }
    for (const shell of Array.from(document.querySelectorAll("[data-promptbox-shell]"))) {
      guardShell(shell);
      if (watchedShells.has(shell)) continue;
      watchedShells.add(shell);
      shellObserver.observe(shell, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:[`${MARK}-thread`, `${MARK}-read-only-label`, `${MARK}-restore-error`, "data-queued-message-id", "data-bb-chat-ui-device", "aria-label", "aria-expanded", "aria-disabled", "disabled", "title", "href", "data-testid", "data-expanded", "class"] });
    }
  };
  // The body only tells us when composer shells (or the host jump button) mount or unmount.
  // Inline composers can also mount inside transcript rows; other transcript changes stay ignored.
  // Search additions locally, sharing one root for sibling rows in the same delivery.
  const observer = new view.MutationObserver(records => {
    let timelineDiscovery: boolean | undefined;
    if (records.some(record => {
      if (record.attributeName === "data-bb-chat-ui-device") return true;
      const target = record.target instanceof view.Element ? record.target : record.target.parentElement;
      if (target?.closest("[data-timeline-items]")) {
        timelineDiscovery ??= Array.from(watchedShells).some(shell => !shell.isConnected) ||
          addedMutationRoots(records).some(root =>
            (root.matches("[data-promptbox-shell]") && !watchedShells.has(root)) ||
            Array.from(root.querySelectorAll("[data-promptbox-shell]")).some(shell => !watchedShells.has(shell)));
        return timelineDiscovery;
      }
      return Array.from(record.addedNodes).some(discoversInfo) || Array.from(record.removedNodes).some(discoversInfo);
    })) {
      watchShells(); discover = true; schedule();
      const marker = "[data-bb-chat-ui-device]";
      if (records.some(record => record.attributeName === "data-bb-chat-ui-device" ||
        [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some(node =>
          node instanceof view.Element && (node.matches(marker) || node.querySelector(marker))))) schedule(undefined, true);
    }
  });
  // Only the plugin's own device marker is watched as an attribute; BB never writes it.
  observer.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:["data-bb-chat-ui-device"] });
  watchShells();
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // The native keyboard sensor consumes Escape after our document listener.
    const target = event.target instanceof view.Element ? event.target : null;
    if (target?.closest('section[aria-label="Queued messages"] :is([data-queued-message-group-divider], [data-queued-message-row]) button[aria-pressed="true"]')) return;
    for (const [stack, state] of states) if (stack.contains(event.target as Node) || event.target === document) state.close(true);
  };
  const onDismiss = (event: MouseEvent) => {
    const button = (event.target as Element).closest?.(`[${MARK}-dismiss]`);
    if (button) for (const [stack, state] of states) if (stack.contains(button)) state.close(true);
  };
  const onOutside = (event: PointerEvent) => {
    const target = event.target as Element;
    if (target.closest?.('[data-radix-popper-content-wrapper], [role="menu"], [role="dialog"]')) return;
    for (const [stack, state] of states) if (!stack.contains(event.target as Node)) state.close();
  };
  document.addEventListener("keydown", onKey);
  document.addEventListener("click", onDismiss);
  document.addEventListener("pointerdown", onOutside);
  view.addEventListener("resize", onResize);
  sync();
  return () => {
    disposed = true;
    observer.disconnect();
    shellObserver.disconnect();
    watchedShells.clear();
    for (const node of guardedNodes) releaseGuards(node);
    document.removeEventListener(composerDataChanged, onData);
    if (frame) view.cancelAnimationFrame(frame);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("click", onDismiss);
    document.removeEventListener("pointerdown", onOutside);
    view.removeEventListener("resize", onResize);
    for (const state of states.values()) state.cleanup();
    states.clear();
    style.remove();
    workflowStyle.remove();
    tailStyle.remove();
  };
}
