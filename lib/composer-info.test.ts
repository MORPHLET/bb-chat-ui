import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { resolvedStyle } from "./test-style.ts";
import { injectComposerInfo, fitComposerInfo, composerInfoCss, scrollOverflowEdges } from "./composer-info.ts";
import { infoKinds } from "./composer-info-settings.ts";
import { queuedMessagesCss } from "./queued-messages.ts";
import { publishInfoData, publishDiffData, readInfoData, readDiffData } from "./composer-data.ts";

let pageDocument: PropertyDescriptor | undefined;

test("Machine Retry fixture uses the common text action and restores its native node on close", async () => {
  const f = fixture(), stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const machine = f.document.createElement('section'); machine.setAttribute('aria-label', 'Machine status');
  machine.innerHTML = '<button id="machine-status-toggle" aria-expanded="false" aria-controls="retry-body">Machine paused</button><div id="retry-body" hidden><p>Could not resume</p><button data-retry>Retry</button><button aria-expanded="false">Details</button></div>';
  stack.append(machine);
  const retry = machine.querySelector<HTMLButtonElement>('[data-retry]')!, parent = retry.parentElement;
  let calls = 0; retry.addEventListener('click', () => calls++);
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="machine"]'); await f.tick();
    const s = resolvedStyle(retry);
    assert.equal(s.height, "24px"); assert.equal(s.borderRadius, '999px');
    assert.equal(s.fontSize, '12px'); assert.equal(s.lineHeight, '14px');
    assert.equal(retry.parentElement, parent); retry.click(); assert.equal(calls, 1);
    assert.equal(machine.querySelector('button[aria-expanded="false"]:not(#machine-status-toggle)')!.hasAttribute('data-bb-chat-ui-card-button'), false);
    machine.querySelector<HTMLButtonElement>('[data-bb-chat-ui-card-close]')!.click();
    assert.equal(retry.hasAttribute('data-bb-chat-ui-card-button'), false);
  } finally { stop(); f.dom.window.close(); }
});
beforeEach(() => { pageDocument = Object.getOwnPropertyDescriptor(globalThis, "document"); });
afterEach(() => {
  if (pageDocument) Object.defineProperty(globalThis, "document", pageDocument);
  else Reflect.deleteProperty(globalThis, "document");
});

// Existing all-family UI scenarios opt in; the default-hidden behavior has its own empty/overflow fixture.
function fixture() {
  const dom = new JSDOM(`<html><head></head><body><div data-scroll-footer><div class="chat-prompt-box"><div data-promptbox-shell><div class="grid">
    <div style="display:contents"><span hidden data-bb-chat-ui-info-settings='{"showInactiveInfo":true}'></span></div>
    <div class="space-y-2"><section aria-label="Child threads"><button id="thread-prompt-banner-child-threads-toggle" aria-expanded="false" aria-label="Active child thread: Review" aria-controls="children">Review</button><div id="children" hidden><a href="/review">Review</a></div></section>
    <section aria-label="Thread context before sending"><button id="thread-prompt-banner-git-toggle">+12 −4 · 3 files</button><a aria-label="Pull request 12: Open" href="https://example.com/pr/12">#12</a></section></div>
    <section aria-label="Goal"><button aria-expanded="false" aria-controls="goal">Goal</button><div id="goal" hidden>Ship composer</div><button aria-label="Clear active Goal">Clear</button></section>
    <section aria-label="To-do list"><button aria-expanded="false" aria-controls="todos">2/5 complete</button><div id="todos" hidden>Verify mobile</div></section>
    <div><div class="plugin-banner">An unknown plugin notice <button>Open notice</button></div></div>
    <section aria-label="Queued messages"><header data-queued-messages-mode="collapsed"><button aria-expanded="false" aria-controls="queue">2</button></header><div id="queue" hidden><div data-queued-messages-scroll-frame><button>Edit message</button></div></div></section>
  </div><div data-follow-up-composer-anchor><div data-follow-up-composer><textarea>keep draft</textarea></div></div></div></div></div></body></html>`, { pretendToBeVisual: true });
  const { document } = dom.window;
  bridgeFixtureData(dom);
  Object.defineProperty(globalThis, "document", { configurable:true, writable:true, value:document });
  for (const toggle of document.querySelectorAll('button[aria-expanded]')) {
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      const body = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
      if (body) body.hidden = !expanded;
    });
  }
  const tick = () => new Promise<void>(resolve => dom.window.setTimeout(resolve, 35));
  const click = (selector: string) => {
    const button = document.querySelector<HTMLButtonElement>(selector);
    assert.ok(button, selector);
    button.click();
    return button;
  };
  return { dom, document, tick, click };
}

test("native and SDK Goal and user message prose use the smallest card size below list names and titles", async () => {
  for(const phone of [false,true]) {
  const f=fixture(),goal=f.document.querySelector('section[aria-label="Goal"]')!;
  f.document.documentElement.setAttribute('data-bb-chat-ui-root-device',phone?'phone':'desktop');
  goal.innerHTML='<div aria-label="Goal controls"><button id="thread-goal-card-toggle" aria-expanded="false" aria-controls="thread-goal-card-body">Goal</button><button aria-label="Clear active Goal">Clear</button></div><section id="thread-goal-card-body" hidden><div><div><p class="text-xs leading-relaxed">Native goal objective</p><div class="flex text-xs text-muted-foreground"><span>100 tokens</span><span>10s</span></div></div></div></section>';
  const toggle=goal.querySelector('button[aria-controls]')!;
  toggle.addEventListener('click',()=>{goal.querySelector<HTMLElement>('#thread-goal-card-body')!.hidden=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(toggle.getAttribute('aria-expanded')!=='true'));});
  const host=f.document.createElement('style');
  host.textContent='.text-xs { font-size:12px; line-height:16px; } .leading-relaxed { line-height:1.625; } code, textarea { font-size:14px; line-height:20px; }';
  f.document.head.append(host);
  const stop=injectComposerInfo(f.document),style=(node:Element)=>resolvedStyle(node);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="goal"]');await f.tick();
    const objective=goal.querySelector('p')!,meta=goal.querySelector('.text-muted-foreground')!;
    assert.equal(style(objective).fontSize,phone?'12px':'11px');
    assert.equal(style(objective).lineHeight,'18px','native leading-relaxed must not enlarge the main body line');
    assert.equal(style(goal.querySelector('[data-bb-chat-ui-card-head]')!).fontSize,phone?'14px':'13px');
    assert.equal(style(goal.querySelector('[data-bb-chat-ui-card-button-label]')!).fontSize,phone?'13px':'12px','actions keep the normal tier');
    assert.equal(style(meta).fontSize,phone?'12px':'11px','native Goal usage is secondary information');
    assert.equal(style(meta).lineHeight,'18px');
    objective.outerHTML='<p class="text-xs leading-relaxed">Rerendered objective <code>code</code></p><textarea>draft</textarea>';
    await f.tick();
    assert.equal(style(goal.querySelector('p')!).lineHeight,'18px','native rerenders keep the shared body type');
    for(const field of goal.querySelectorAll('code,textarea')){
      assert.equal(style(field).fontSize,'14px','code and inputs retain their own typography');
      assert.equal(style(field).lineHeight,'20px');
    }
    f.click('[aria-label="Goal 닫기"]');
    for(const kind of ['goal','queue']){
      goal.remove();
      const sdk=f.document.createElement('section');sdk.setAttribute('data-bb-chat-ui-info-kind',kind);sdk.setAttribute('aria-label',kind==='goal'?'Goal':'대기 메시지');
      sdk.innerHTML='<h3 data-bb-chat-ui-card-head><span data-bb-chat-ui-card-title>Title</span></h3><div data-bb-chat-ui-card-body><p>Main content</p><p class="text-subtle-foreground">Status and usage</p></div>';
      if(kind==='queue')f.document.querySelector('section[aria-label="Queued messages"]')!.remove();
      f.document.querySelector('[data-promptbox-shell] > .grid')!.append(sdk);await f.tick();
      f.click(`[data-bb-chat-ui-info-trigger="${kind}"]`);await f.tick();
      const paragraphs=sdk.querySelectorAll('p');
      assert.equal(style(paragraphs[0]).fontSize,phone?'12px':'11px',`${kind}: long content uses the smallest tier`);
      assert.equal(style(paragraphs[0]).lineHeight,'18px');
      assert.equal(style(paragraphs[1]).fontSize,phone?'12px':'11px',`${kind}: SDK status uses the same secondary size`);
      assert.equal(style(paragraphs[1]).lineHeight,'18px');
      assert.equal(style(sdk.querySelector('[data-bb-chat-ui-card-title]')!).fontSize,phone?'14px':'13px');
      f.click(`[aria-label="${kind==='goal'?'Goal':'대기 메시지'} 닫기"]`);sdk.remove();
    }
  } finally {stop();}
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(goal);
  assert.equal(style(goal.querySelector('p')!).lineHeight,'1.625','unload restores native paragraph typography');
  assert.equal(style(goal.querySelector('.text-muted-foreground')!).fontSize,'12px');
  f.dom.window.close();
  }
});

test("Workflow and background metadata keep one secondary size across host device utilities", () => {
  for(const phone of [false,true]){
    const host=`.text-xs {font-size:${phone?14:12}px;line-height:${phone?20:16}px} .text-2xs {font-size:${phone?11:10}px;line-height:${phone?15:14}px}`;
    const dom=new JSDOM(`<style>${host}\n${composerInfoCss}</style><div data-promptbox-shell><div class="grid" data-bb-chat-ui-info-stack>
      <section data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="workflow" aria-label="Workflow">
        <header data-bb-chat-ui-card-head><span data-bb-chat-ui-card-title>Run title</span><span class="text-2xs" data-meta>2/3 agents</span></header>
        <section role="region"><div data-detail-scroll-area><div class="flex flex-col gap-1.5">
          <div><button aria-expanded="true"><span class="text-xs" data-main>Review</span><span class="text-xs tabular-nums" data-meta>1/2</span></button><div class="flex flex-col"><div class="flex min-h-7 items-center gap-1.5"><span class="truncate text-xs" data-main>Agent task</span><span class="ml-auto"><span class="text-2xs" data-meta>codex · model · medium</span></span></div></div></div>
          <div class="flex items-center gap-1.5"><span class="text-xs" data-main>Next phase</span><span class="text-xs tabular-nums" data-meta>not started</span></div>
        </div></div></section>
      </section>
      <section data-bb-chat-ui-info-unit data-bb-chat-ui-info-open="background" aria-label="Background activity"><div id="thread-background-commands-card-body"><div><div class="flex flex-col"><div class="px-3"><span data-main>Background task</span><span class="tabular-nums" data-meta>26m</span></div></div></div></div></section>
    </div></div>`);
    try{
      dom.window.document.documentElement.setAttribute('data-bb-chat-ui-root-device',phone?'phone':'desktop');
      for(const node of dom.window.document.querySelectorAll('[data-main],[data-meta]')){
        const s=resolvedStyle(node),meta=node.hasAttribute('data-meta');
        assert.equal(s.fontSize,meta?(phone?'12px':'11px'):(phone?'13px':'12px'),`${phone?'phone':'desktop'}: ${node.textContent}`);
        assert.equal(s.lineHeight,meta?'18px':phone?'16px':'14px',`${node.textContent}: role line-height`);
      }
    } finally {dom.window.close();}
  }
});

test("Diff file paths and commit subjects share the secondary size while retaining the code font", () => {
  for(const phone of [false,true]) {
  const dom=new JSDOM(`<style>${composerInfoCss}</style><div data-bb-chat-ui-info-diff-file><code>lib/example.ts</code><span>+12</span></div><div data-bb-chat-ui-info-diff-commit><code>Commit subject</code></div>`);
  dom.window.document.documentElement.setAttribute('data-bb-chat-ui-root-device',phone?'phone':'desktop');
  for(const text of dom.window.document.querySelectorAll('code')){
    const s=resolvedStyle(text);
    assert.equal(s.fontSize,phone?'12px':'11px');
    assert.equal(s.lineHeight,'18px');
    assert.match(s.fontFamily,/mono/,'code labels retain their code font');
  }
  assert.equal(resolvedStyle(dom.window.document.querySelector('span')!).fontSize,phone?'12px':'11px');
  dom.window.close();
  }
});

test("PR Merge opens the native method menu without merging; only an option executes", async () => {
  const f=fixture();
  const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  const group=f.document.createElement('div');
  group.innerHTML='<button type="button">Merge</button><button type="button" aria-label="Choose pull request merge method" aria-expanded="false"><svg><path /></svg></button>';
  context.append(group);
  const [merge,caret]=Array.from(group.querySelectorAll('button'));
  let merges=0,opens=0;
  merge.addEventListener('click',()=>merges++);
  caret.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();opens++;caret.setAttribute('aria-expanded','true');}});
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    merge.click();
    assert.equal(merges,0,'the main button must never run its native immediate merge');
    assert.equal(opens,1);
    await f.tick();
    assert.equal(merge.getAttribute('aria-haspopup'),'menu');
    assert.equal(merge.getAttribute('aria-expanded'),'true');
    assert.equal(merge.getAttribute('tabindex'),'-1','only the native full-pill trigger stays in the tab order');
    assert.equal(merge.getAttribute('aria-hidden'),'true');
    const option=f.document.createElement('button');option.setAttribute('role','menuitem');option.textContent='Squash merge';
    option.addEventListener('click',()=>merges++);f.document.body.append(option);option.click();
    assert.equal(merges,1,'native menu actions remain untouched');
    caret.disabled=true;merge.click();assert.equal(opens,1);assert.equal(merges,1);
  } finally {stop();}
  merge.click();assert.equal(merges,2,'unload restores the native main action');
  assert.equal(merge.hasAttribute('aria-haspopup'),false);
  assert.equal(merge.hasAttribute('aria-hidden'),false);
  assert.equal(merge.hasAttribute('tabindex'),false);
  f.dom.window.close();
});

test("PR Merge also opens click-based compact menus, including nested targets and dynamic buttons", async () => {
  const f=fixture(),stop=injectComposerInfo(f.document);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');
    const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
    const group=f.document.createElement('div');
    group.innerHTML='<button type="button"><span>Squash merge</span></button><button type="button" aria-label="Choose pull request merge method" aria-expanded="false">▾</button>';
    context.append(group);
    const [merge,caret]=Array.from(group.querySelectorAll('button'));
    let merges=0,opens=0;merge.addEventListener('click',()=>merges++);caret.addEventListener('click',()=>opens++);
    group.querySelector('span')!.click();assert.equal(merges,0);assert.equal(opens,1);
    caret.click();assert.equal(opens,2,'the caret still opens the same native menu');
    merge.setAttribute('aria-disabled','true');merge.click();assert.equal(opens,2);assert.equal(merges,0);
    const unrelated=f.document.createElement('button');unrelated.textContent='Merge';f.document.body.append(unrelated);
    unrelated.addEventListener('click',()=>merges++);unrelated.click();assert.equal(merges,1);
  } finally {stop();f.dom.window.close();}
});

test("PR method menus stay above the popover and the header reserves its close-button gutter", async () => {
  const f=fixture();
  const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  context.innerHTML='<div class="p-1" data-bb-chat-ui-info-close-heading><a aria-label="Pull request 12: Open">PR #12</a><div><button>Merge</button><button aria-label="Choose pull request merge method" aria-expanded="false" aria-controls="pr-methods">▾</button></div></div>';
  const layer=f.document.createElement('div');layer.setAttribute('data-radix-popper-content-wrapper','');
  layer.innerHTML='<div role="menu" id="pr-methods">Merge</div>';f.document.body.append(layer);
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');
    const caret=context.querySelector('[aria-label="Choose pull request merge method"]')!;
    caret.setAttribute('aria-expanded','true');await f.tick();
    assert.equal(layer.hasAttribute('data-bb-chat-ui-pr-menu-layer'),true);
    assert.equal(layer.firstElementChild!.hasAttribute('data-bb-chat-ui-pr-menu'),true);
    assert.equal(resolvedStyle(context.firstElementChild!).paddingRight,"32px",'8px inset + 24px close + 8px gap');
  } finally {stop();}
  assert.equal(layer.hasAttribute('data-bb-chat-ui-pr-menu-layer'),false);
  assert.equal(layer.firstElementChild!.hasAttribute('data-bb-chat-ui-pr-menu'),false);
  f.dom.window.close();
});

test("PR uses a compact 40px navigation card with a separate text-and-caret Merge action", async () => {
  const f=fixture();
  const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  context.innerHTML='<div class="p-1"><a aria-label="Pull request 12: Open" href="https://example.com/pr/12" class="px-2"><span title="Open" class="flex"><svg /></span><span>PR #12</span></a><div><div class="inline-flex overflow-hidden rounded border"><button>Merge</button><button aria-label="Choose pull request merge method" aria-expanded="false"><svg /></button></div></div></div>';
  const native=f.document.createElement('style');native.textContent='.px-2 { padding-left:8px; }';f.document.head.append(native);
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    const style=(node:Element)=>resolvedStyle(node);
    const link=context.querySelector('a')!,group=context.querySelector('.inline-flex')!;
    assert.equal(style(group.parentElement!).marginLeft,'auto','Merge stays at the close end while the PR detail link follows its title');
    assert.ok(link.hasAttribute('data-bb-chat-ui-card-navigation'),'the original PR link owns the full-card target');
    assert.equal(style(link).position,'static','the stretched target anchors to the card');
    assert.equal(style(link).overflow,'visible','the native icon link must not clip its full-card target');
    assert.equal(style(link).paddingLeft,'0px');
    assert.equal(style(link).paddingRight,'0px');
    assert.equal(style(link).paddingTop,'0px');
    assert.equal(style(link).paddingBottom,'0px');
    assert.equal(style(link.querySelector('span[title]')!).display,'none','hidden native artwork must not leave an empty box');
    assert.equal(style(group).borderTopWidth,'0px','Merge has no outer outline');
    assert.equal(style(group).borderRadius,'0px');
    assert.equal(style(group).padding,'0px 22px 0px 0px','only the 14px caret and 8px text gap reserve space');
    assert.equal(style(group).height,"24px",'the shared text action height');
    assert.equal(style(group).backgroundColor,'rgba(0, 0, 0, 0)','no second frost inside the card');
    assert.equal(style(group).getPropertyValue('backdrop-filter'),'none');
    assert.equal(style(group).position,'relative');
    assert.equal(style(group).zIndex,'1','Merge stays above the primary navigation target');
    for(const button of group.querySelectorAll('button')){
      assert.equal(style(button).backgroundColor,'rgba(0, 0, 0, 0)');
      assert.equal(style(button).boxShadow,'none');
      assert.equal(style(button).borderRadius,'0px');
    }
    const [label,trigger]=Array.from(group.querySelectorAll('button'));
    assert.equal(style(label).fontSize,'12px','Merge shares the common text action size');
    assert.equal(style(label).lineHeight,'14px');
    assert.equal(style(label).pointerEvents,'none');
    assert.equal(style(label).height,'20px');
    assert.equal(style(trigger).position,'absolute');
    assert.equal(style(trigger).width,'100%');
    assert.equal(style(trigger).height,'100%');
    assert.equal(style(trigger).padding,'0px');
    assert.equal(context.getAttribute('data-bb-chat-ui-card-layout'),'single-row');
    assert.equal(style(context.querySelector('[data-bb-chat-ui-card-head]')!).height,"36px");
    assert.equal(style(context.querySelector('[data-bb-chat-ui-card-head]')!).paddingLeft,"12px",'the leading content matches the close glyph inset');
    assert.equal(style(context.querySelector('[data-bb-chat-ui-card-head]')!).marginBottom,'0px','a PR header without a body has no trailing body gap');
    const close=context.querySelector('[data-bb-chat-ui-info-native-dismiss]')!;
    assert.ok(close.hasAttribute('data-bb-chat-ui-card-close'));
    assert.equal(style(close).position,'absolute');assert.equal(style(close).top,'8px','the close centers on the 40px card');
  } finally {stop();f.dom.window.close();}
});

test("PR controls inside github-pr-status plugin slots keep the native row as the 36px header", async () => {
  const f=fixture();
  const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  context.innerHTML='<div class="flex items-center gap-0.5 p-1"><div data-bb-plugin-root data-bb-plugin="bb--github-pr-status" class="contents"><span role="group" aria-label="Pull request" class="contents"><a aria-label="Pull request 12: Open, No checks" href="https://example.com/pr/12" class="px-2"><span title="Open, No checks" class="flex"><svg /></span><span data-promptbox-hide-compact>PR #12</span></a></span></div><button type="button" id="thread-prompt-banner-git-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-git-body">+12 −4 · 3 files</button><div data-bb-plugin-root data-bb-plugin="bb--github-pr-status" class="contents"><div data-promptbox-hide-tiny class="flex"><div class="inline-flex overflow-hidden rounded border"><button>Merge</button><button aria-label="Choose pull request merge method" aria-expanded="false"><svg /></button></div></div></div></div><section id="thread-prompt-banner-git-body" hidden>lib/composer-info.ts</section>';
  const native=f.document.createElement('style');native.textContent='.contents { display:contents; }';f.document.head.append(native);
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    const row=context.firstElementChild!,group=context.querySelector('.inline-flex')!,link=context.querySelector('a')!;
    assert.ok(row.hasAttribute('data-bb-chat-ui-card-head'),'the native row, not the display:contents plugin slot, is the header');
    assert.equal(context.querySelectorAll('[data-bb-chat-ui-card-head]').length,1);
    assert.equal(resolvedStyle(row).height,'36px');
    assert.equal(resolvedStyle(row).paddingLeft,'12px','the GitHub mark keeps the card inset');
    assert.equal(link.nextElementSibling?.getAttribute('data-bb-chat-ui-info-pr-title'),'','the title follows the link inside its slot');
    assert.equal(resolvedStyle(group.parentElement!).marginLeft,'auto','Merge sits at the close end');
    assert.ok(group.parentElement!.hasAttribute('data-bb-chat-ui-card-end-action'),'the end action is the visible box, not the plugin root');
  } finally {stop();f.dom.window.close();}
});

test("the SDK PR fallback uses the same single row without a family title or family icon", async () => {
  const f=fixture(),source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-pr-title','SDK PR title');
  source.insertAdjacentHTML('beforeend','<span data-bb-chat-ui-info-icon="pullRequest"><svg /></span>');
  f.document.querySelector('section[aria-label="Thread context before sending"]')!.remove();
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML('beforeend','<div data-bb-chat-ui-info-supplements><section data-bb-chat-ui-info-kind="pullRequest" aria-label="Pull request"><div><a aria-label="Pull request 42: Open" href="https://example.com/pr/42">SDK PR title</a></div></section></div>');
  const card=stack.querySelector('[data-bb-chat-ui-info-kind="pullRequest"]')!,link=card.querySelector('a')!;
  const stop=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    assert.equal(card.getAttribute('data-bb-chat-ui-card-layout'),'single-row');
    assert.equal(card.querySelector('[data-bb-chat-ui-info-title-icon]'),null);
    assert.equal(card.querySelector('[data-bb-chat-ui-info-pr-title]')?.textContent,'SDK PR title');
    assert.equal(link.nextElementSibling,card.querySelector('[data-bb-chat-ui-info-pr-title]'),'the original SDK link leads the generated title');
    assert.equal(resolvedStyle(card.querySelector('[data-bb-chat-ui-card-head]')!).height,"36px");
    assert.ok(link.hasAttribute('data-bb-chat-ui-card-navigation'));
    f.click('[data-bb-chat-ui-card-close]');await f.tick();
    assert.equal(card.hasAttribute('data-bb-chat-ui-card-layout'),false);
    f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    assert.equal(card.getAttribute('data-bb-chat-ui-card-layout'),'single-row');
  } finally {stop();}
  assert.equal(card.hasAttribute('data-bb-chat-ui-card-layout'),false);
  assert.equal(link.textContent,'SDK PR title');
  assert.equal(link.getAttribute('title'),null);
  assert.equal(link.hasAttribute('data-bb-chat-ui-card-navigation'),false,'unload restores the SDK-owned link');
  f.dom.window.close();
});

test("PR navigation follows native link replacement and restores attributes owned by the source", async () => {
  const f=fixture(),card=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  card.innerHTML='<div class="p-1"><a href="https://example.com/pr/12" aria-label="Pull request 12: Open" data-bb-chat-ui-card-navigation="source" title="Original">#12</a></div>';
  const original=card.querySelector('a')!,parent=original.parentElement;
  const stop=injectComposerInfo(f.document);
  try{
    f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    assert.equal(original.getAttribute('data-bb-chat-ui-card-navigation'),'source');
    assert.equal(original.parentElement,parent);
    card.innerHTML='<div class="p-1"><a href="https://example.com/pr/13" aria-label="Pull request 13: Open">#13</a></div>';
    await f.tick();
    const replacement=card.querySelector('a')!;
    assert.ok(replacement.hasAttribute('data-bb-chat-ui-card-navigation'));
    assert.equal(replacement.getAttribute('href'),'https://example.com/pr/13');
    assert.equal(original.getAttribute('title'),'Original');
    assert.equal(original.getAttribute('data-bb-chat-ui-card-navigation'),'source');
    let opens=0;replacement.addEventListener('click',e=>{e.preventDefault();opens++;});
    replacement.click();assert.equal(opens,1);
    f.click('[data-bb-chat-ui-card-close]');
    assert.equal(opens,1,'closing never activates navigation');
    assert.equal(replacement.hasAttribute('data-bb-chat-ui-card-navigation'),false);
    assert.equal(replacement.getAttribute('title'),null);
  }finally{stop();f.dom.window.close();}
});

test("PR header shows the SDK title on one line and keeps a separate GitHub link", async () => {
  const f=fixture();
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-pr-title','긴 Pull request 제목으로 좁은 화면에서 말줄임을 확인');
  const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  context.innerHTML='<div class="p-1"><a aria-label="Pull request 42: Open" href="https://github.com/example/repo/pull/42"><span>PR #42</span></a><div><div class="inline-flex overflow-hidden rounded border"><button>Merge</button><button aria-label="Choose pull request merge method">▾</button></div></div></div>';
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    const title=context.querySelector<HTMLElement>('[data-bb-chat-ui-info-pr-title]');
    const link=context.querySelector<HTMLAnchorElement>('a[aria-label^="Pull request "]')!;
    assert.equal(title?.textContent,'긴 Pull request 제목으로 좁은 화면에서 말줄임을 확인');
    assert.equal(title?.getAttribute('title'),title?.textContent);
    assert.equal(resolvedStyle(title!).textOverflow,'ellipsis');
    assert.equal(resolvedStyle(title!).whiteSpace,'nowrap');
    assert.equal(link.href,'https://github.com/example/repo/pull/42');
    assert.equal(link.getAttribute('title'),'GitHub에서 PR 열기');
    assert.equal(link.nextElementSibling,title,'the GitHub link is before the PR title');
    const iconRule=[...f.document.styleSheets].flatMap(sheet=>[...sheet.cssRules]).find(rule=>'selectorText' in rule && rule.selectorText.endsWith('a[aria-label^="Pull request "]::after')) as CSSStyleRule;
    assert.equal(iconRule.style.content,'""');
    assert.equal(iconRule.style.width,"12px");
    assert.match(iconRule.style.getPropertyValue('mask'),/data:image\/svg\+xml/);
    assert.equal(resolvedStyle(link).fontSize,'0px');
    source.setAttribute('data-bb-chat-ui-info-pr-title','갱신된 PR 제목');await f.tick();
    assert.equal(title?.textContent,'갱신된 PR 제목');
  } finally {stop();}
  assert.equal(context.querySelector('[data-bb-chat-ui-info-pr-title]'),null);
  assert.equal(context.querySelector('a')?.hasAttribute('title'),false);
  f.dom.window.close();
});

// The historical DOM fixtures encode SDK responses as JSON. Adapt only the fixtures;
// production bridges publish typed objects and never read these attributes.
function bridgeFixtureData(dom: JSDOM) {
  const { document, Element, MutationObserver } = dom.window;
  const marker='data-bb-chat-ui-info-settings', diff='data-bb-chat-ui-head-diff';
  const parse=(text:string | null, fallback:unknown) => {try{return text ? JSON.parse(text) : fallback;}catch{return fallback;}};
  const actions=new WeakMap<Element,(id:string)=>void>();
  const syncInfo=(source:Element) => {
    let openThread=actions.get(source);
    if (!openThread) { openThread=id=>{
      const target=Array.from(source.querySelectorAll<HTMLButtonElement>('[data-bb-chat-ui-info-parent-open]')).find(n=>n.getAttribute('data-bb-chat-ui-info-parent-open')===id);
      if(target)target.click();
      else source.closest('[data-promptbox-shell]')?.querySelector<HTMLAnchorElement>('section[aria-label="Thread context before sending"] a[href*="/threads/"]')?.click();
    };actions.set(source,openThread); }
    publishInfoData(source,{settings:parse(source.getAttribute(marker),{}) as Record<string,unknown>,children:parse(source.getAttribute('data-bb-chat-ui-info-children'),[]) as never,parent:parse(source.getAttribute('data-bb-chat-ui-info-parent'),null) as never,openThread});
  };
  const syncDiff=(source:Element) => {
    const summary=parse(source.getAttribute(diff),null) as never;
    publishDiffData(source,{threadId:source.closest('[data-promptbox-shell]')?.querySelector(`[${marker}]`)?.getAttribute('data-bb-chat-ui-info-thread') ?? 'fixture',summary,state:source.getAttribute(`${diff}-state`)==='unavailable'?'unavailable':summary?'ready':'loading'});
  };
  const hydrate=(node:Element) => {
    if(node.hasAttribute(marker)&&!readInfoData(node))syncInfo(node);
    if(node.hasAttribute(diff)&&!readDiffData(node))syncDiff(node);
    for(const source of node.querySelectorAll(`[${marker}]`))if(!readInfoData(source))syncInfo(source);
    for(const source of node.querySelectorAll(`[${diff}]`))if(!readDiffData(source))syncDiff(source);
  };
  hydrate(document.documentElement);
  const set=Element.prototype.setAttribute,remove=Element.prototype.removeAttribute;
  const update=(node:Element,name:string) => {
    if([marker,'data-bb-chat-ui-info-children','data-bb-chat-ui-info-parent'].includes(name)&&node.hasAttribute(marker))syncInfo(node);
    if([diff,`${diff}-state`].includes(name)&&node.hasAttribute(diff))syncDiff(node);
  };
  Element.prototype.setAttribute=function(name:string,value:string){set.call(this,name,value);update(this,name);};
  Element.prototype.removeAttribute=function(name:string){remove.call(this,name);update(this,name);};
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node instanceof Element)hydrate(node);}).observe(document.body,{subtree:true,childList:true});
}

test("the catalog hover gutter never pulls a detail body left of its heading", async () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="diff"]'); await f.tick();
    const detail = f.document.querySelector('[data-bb-chat-ui-info-diff-content]')!;
    const bodyStyle = resolvedStyle(detail);
    assert.equal(parseFloat(bodyStyle.marginLeft) || 0, 0, "Diff shares the card's title gutter");
    assert.equal(parseFloat(bodyStyle.marginRight) || 0, 0);
    f.click('[data-bb-chat-ui-info-all]'); await f.tick();
    const choice = f.document.querySelector('[data-bb-chat-ui-info-choice]')!;
    assert.equal(resolvedStyle(choice.parentElement!).marginLeft, "-4px", "only the catalog extends its hover paint");
  } finally { stop(); f.dom.window.close(); }
});

test("native child titles and rows use the shared card typography and gutter", async () => {
  const f = fixture();
  const card = f.document.querySelector('section[aria-label="Child threads"]')!;
  card.innerHTML = '<button id="thread-prompt-banner-child-threads-toggle" aria-expanded="false" aria-controls="children"><span class="flex-1 truncate font-normal">Active child threads</span></button><section id="children" hidden><div><ul class="px-3 space-y-0.5"><li><a href="/review">Review</a></li></ul></div></section>';
  const label = card.querySelector('button > span')!;
  const parent = label.parentElement;
  const utilities = f.document.createElement('style');
  utilities.textContent = '.font-normal { font-weight:400; } .flex-1 { flex:1; }';
  f.document.head.append(utilities);
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="children"]'); await f.tick();
    assert.ok(label.hasAttribute('data-bb-chat-ui-card-title'));
    assert.equal(resolvedStyle(label).fontWeight, '600');
    assert.equal(resolvedStyle(label).flexGrow, '0');
    const row = card.querySelector('li > a')!;
    assert.equal(resolvedStyle(row).padding, "4px");
    assert.equal(resolvedStyle(row).borderRadius, "8px");
    assert.equal(label.parentElement, parent, 'native title nodes keep their parent');
  } finally { stop(); }
  assert.equal(label.hasAttribute('data-bb-chat-ui-card-title'), false, 'unload restores the native title');
  f.dom.window.close();
});

test("todo rows extend their hover gutter once while the list keeps the title edge", async () => {
  const f = fixture();
  const body = f.document.querySelector('#todos')!;
  body.innerHTML = '<ul class="px-2.5"><li class="px-2">Verify phone</li></ul>';
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="todos"]'); await f.tick();
    const list = body.querySelector('ul')!;
    assert.equal(parseFloat(resolvedStyle(list).marginLeft) || 0, 0);
    const row = list.querySelector('li')!;
    assert.equal(resolvedStyle(row).marginLeft, "-4px");
    assert.equal(resolvedStyle(row).paddingLeft, "4px");
  } finally { stop(); f.dom.window.close(); }
});

test("long todo paths wrap within the card", async () => {
  const f = fixture();
  const body = f.document.querySelector('#todos')!;
  body.innerHTML = '<ul class="px-2.5"><li class="px-2"></li></ul>';
  const row = body.querySelector('li')!;
  row.textContent = 'lib/aVeryLongComponentIdentifierWithoutSpaces'.repeat(6);
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="todos"]'); await f.tick();
    const style = resolvedStyle(row);
    assert.equal(style.overflowWrap, 'anywhere', 'unbroken paths can wrap before crossing the card edge');
    assert.equal(style.minWidth, '0px');
  } finally { stop(); f.dom.window.close(); }
});

test("long information paragraphs wrap without changing code blocks", async () => {
  const f = fixture();
  const banner = f.document.querySelector('.plugin-banner')!;
  const cards: [string, Element][] = [['other', banner]];
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  for (const [kind, label] of [['plan', 'Prompt mode'], ['fallback', 'Model fallback'], ['machine', 'Machine status']]) {
    const card = f.document.createElement('section');
    card.setAttribute('aria-label', label);
    stack.append(card);
    cards.push([kind, card]);
  }
  for (const [, card] of cards) {
    card.innerHTML = '<h3>Information</h3><p></p><pre><code>keep code spacing</code></pre>';
    card.querySelector('p')!.textContent = 'https://example.com/' + 'longPathWithoutSpaces'.repeat(20);
  }
  const stop = injectComposerInfo(f.document);
  try {
    for (const [kind, card] of cards) {
      f.click('[data-bb-chat-ui-info-all]'); f.click(`[data-bb-chat-ui-info-choice="${kind}"]`); await f.tick();
      assert.equal(resolvedStyle(card.querySelector('p')!).overflowWrap, 'anywhere', `${kind}: body paragraphs can wrap unbroken strings`);
      assert.equal(resolvedStyle(card.querySelector('pre')!).overflowWrap, 'normal', `${kind}: code blocks retain their own formatting`);
    }
  } finally { stop(); f.dom.window.close(); }
});

test("native child lists scroll at the shared card cap without clipping row gutters", async () => {
  const f = fixture();
  const native = f.document.createElement('style');
  native.textContent = '.native-child-cap{max-height:160px;overflow-y:auto}.native-child-reveal{overflow:hidden}';
  f.document.head.append(native);
  const card = f.document.querySelector('section[aria-label="Child threads"]')!;
  card.querySelector('#children')!.outerHTML = '<section id="children" role="region" hidden class="native-child-reveal"><div class="native-child-reveal bg-popover"><ul class="native-child-cap"><li><a href="/review">Review</a></li></ul></div></section>';
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="children"]'); await f.tick();
    const style = (node: Element) => resolvedStyle(node);
    assert.equal(style(card.querySelector('ul')!).maxHeight, 'none');
    assert.equal(style(card.querySelector('ul')!).overflow, 'visible');
    for (const reveal of card.querySelectorAll('.native-child-reveal')) {
      assert.equal(style(reveal).overflow, 'visible');
      assert.equal(style(reveal).minWidth, '0px');
    }
  } finally { stop(); }
  assert.equal(resolvedStyle(card.querySelector('ul')!).maxHeight, '160px', 'unload restores the native limit');
  f.dom.window.close();
});

test("native body adapters remove duplicate vertical insets and keep the common title gap", async () => {
  const cases = [
    ['children', 'Child threads', 'children-inset', '<ul data-inset style="padding:6px 0 0"><li>Child</li></ul>'],
    ['goal', 'Goal', 'thread-goal-card-body', '<div data-inset style="padding:8px 0 10px">Goal body</div>'],
    ['background', 'Background agents', 'thread-background-commands-card-body', '<div class="flex-col" data-inset style="padding:4px 0">Activity</div>'],
    ['workflow', 'Workflow', 'workflow-inset', '<div data-detail-scroll-area data-inset style="padding:8px 0">Phase</div>'],
    ['queue', 'Queued messages', 'queue-inset', '<div data-queued-messages-scroll data-inset style="padding:4px 0"><ul data-inset style="padding:4px 0"><li>Message</li></ul></div>'],
  ] as const;
  for (const [kind, label, id, content] of cases) {
    const f = fixture();
    const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
    stack.querySelector(`section[aria-label="${label}"]`)?.remove();
    const card = f.document.createElement('section');
    card.setAttribute('aria-label', label);
    card.innerHTML = `<button ${kind === 'children' ? 'id="thread-prompt-banner-child-threads-toggle"' : ''} aria-expanded="false" aria-controls="${id}">${label}</button><section role="region" id="${id}" hidden><div class="bg-popover">${content}</div></section>`;
    const toggle = card.querySelector('button')!;
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      card.querySelector('section')!.hidden = !expanded;
    });
    stack.append(card);
    const stop = injectComposerInfo(f.document);
    try {
      f.click('[data-bb-chat-ui-info-all]'); f.click(`[data-bb-chat-ui-info-choice="${kind}"]`); await f.tick();
      for (const body of card.querySelectorAll('[data-inset]')) {
        const style = resolvedStyle(body);
        assert.equal(style.paddingTop, '0px', `${kind}: the card owns the top inset`);
        assert.equal(style.paddingBottom, '0px', `${kind}: the card owns the bottom inset`);
      }
      if (kind === 'queue') assert.equal(resolvedStyle(card.querySelector('[data-bb-chat-ui-card-head]')!).marginBottom, "10px");
    } finally { stop(); f.dom.window.close(); }
  }
});

test("a touch-sized Goal action keeps the shared title and close on the 28px line", async () => {
  const f = fixture();
  f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target','large');
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="goal"]'); await f.tick();
    const card=f.document.querySelector('section[aria-label="Goal"]')!;
    assert.equal(resolvedStyle(card).gridTemplateRows,"30px auto");
    assert.equal(resolvedStyle(card.querySelector('[aria-label="Clear active Goal"]')!).height,'24px');
  } finally { stop(); f.dom.window.close(); }
});

test("the native PR merge group uses the shared 32px touch action", async () => {
  const f=fixture();
  f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target','large');
  const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  context.innerHTML='<div class="p-1"><a aria-label="Pull request 12: Open" href="https://example.com/pr/12">PR #12</a><div><div class="inline-flex overflow-hidden rounded border"><button>Merge</button><button aria-label="Choose pull request merge method">▾</button></div></div></div>';
  const group=context.querySelector('.inline-flex')!;
  const parent=group.parentElement;
  const stop=injectComposerInfo(f.document);
  try{
    f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');await f.tick();
    assert.equal(resolvedStyle(group).height,"24px");
    assert.equal(group.parentElement,parent);
  }finally{stop();f.dom.window.close();}
});

function stubAnimations(window: { HTMLElement: { prototype: HTMLElement & { animate: Function; getAnimations: Function } } }) {
  const live = new WeakMap<Element, Animation[]>();
  window.HTMLElement.prototype.getAnimations = function() { return (live.get(this) ?? []).slice(); };
  return function(this: HTMLElement, frames?: Keyframe[] | PropertyIndexedKeyframes | null, options?: number | KeyframeAnimationOptions) {
    const record = {
      node: this,
      frames: (Array.isArray(frames) ? frames : []) as Keyframe[],
      options: (typeof options === "number" ? { duration: options } : options ?? {}) as KeyframeAnimationOptions,
      animation: null as unknown as Animation,
      cancelled: false,
    };
    const animation = {
      effect: { target: this, getTiming: () => ({ fill: (typeof options === "object" ? options?.fill : undefined) ?? "none" }) },
      cancel() { record.cancelled = true; this.oncancel?.(); },
    } as Animation;
    record.animation = animation;
    const list = live.get(this) ?? [];
    list.push(animation);
    live.set(this, list);
    return record;
  };
}

test("SDK objects render Diff and child pills without data attributes and update an open Diff", async () => {
  const f=fixture();
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  const diffSource=f.document.createElement('span');diffSource.hidden=true;
  diffSource.setAttribute('data-bb-chat-ui-head-diff','');source.parentElement!.append(diffSource);
  const children=[{id:'sdk-child',title:'SDK child',providerId:'codex',state:'run' as const}];
  publishInfoData(source,{settings:{showGoal:'끄기'},children,parent:null});
  const snapshot={insertions:7,deletions:2,files:1,branch:'feature/ui',presentation:{mode:'working' as const,visible:true,branch:'feature/ui',branchLabel:null,label:'+7 −2 · 1 file'},detail:{branch:'feature/ui',basis:'HEAD',baseRef:'origin/main',files:[{path:'lib/direct.ts',status:'M',insertions:7,deletions:2}],commits:[]}};
  publishDiffData(diffSource,{threadId:'sdk-thread',state:'ready',summary:snapshot});
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]'),null);
    assert.match(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!.textContent!,/\+7/);
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-avatar]')?.getAttribute('title'),'SDK child · codex');
    f.click('[data-bb-chat-ui-info-trigger="diff"]');await f.tick();
    assert.match(f.document.querySelector('[data-bb-chat-ui-info-menu]')!.textContent!,/lib\/direct.ts/);
    publishDiffData(diffSource,{threadId:'sdk-thread',state:'ready',summary:{...snapshot,insertions:9,presentation:{...snapshot.presentation,label:'+9 −2 · 1 file'},detail:{...snapshot.detail,files:[{...snapshot.detail.files[0],path:'lib/updated.ts',insertions:9}]}}});
    await f.tick();
    assert.match(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!.textContent!,/\+9/);
    assert.match(f.document.querySelector('[data-bb-chat-ui-info-menu]')!.textContent!,/lib\/updated.ts/);
    assert.equal(diffSource.getAttribute('data-bb-chat-ui-head-diff'),'');
    assert.equal(source.hasAttribute('data-bb-chat-ui-info-children'),false);
  } finally {stop();f.dom.window.close();}
});

test("Parent navigation reads the current SDK action without a hidden proxy button", async () => {
  const f=fixture(),source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  f.document.querySelector('section[aria-label="Thread context before sending"]')!.insertAdjacentHTML('beforeend','<a href="/threads/native-parent">Native parent</a>');
  const moves:string[]=[];
  const data={settings:{},children:[],parent:{id:'one',title:'첫 부모',providerId:'codex'},openThread:(id:string)=>moves.push(id)};
  publishInfoData(source,data);
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();f.click('[data-bb-chat-ui-info-trigger="parent"]');await f.tick();
    f.click('[data-bb-chat-ui-info-parent-row]');assert.deepEqual(moves,['one']);
    publishInfoData(source,{...data,parent:{id:'two',title:'다음 부모',providerId:'codex'}});
    await f.tick();
    assert.match(f.document.querySelector('[data-bb-chat-ui-info-parent-row]')!.textContent!,/다음 부모/);
    f.click('[data-bb-chat-ui-info-parent-row]');assert.deepEqual(moves,['one','two']);
    publishInfoData(source,{...data,parent:null});await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-parent-row]'),null);
    assert.equal(source.querySelector('[data-bb-chat-ui-info-parent-open]'),null);
  } finally {stop();f.dom.window.close();}
});

test("unrelated chat mutations do not recalculate composer info, while composer changes still do", async () => {
  const f = fixture();
  const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  let measurements = 0;
  stack.getBoundingClientRect = () => { measurements++; return { width:900 } as DOMRect; };
  const chat = f.document.createElement('article');
  chat.textContent = 'stream'; f.document.body.prepend(chat);
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick(); measurements = 0;
    chat.firstChild!.textContent = 'stream update';
    chat.title = 'unrelated title';
    chat.append(f.document.createElement('span'));
    f.document.body.append(f.document.createElement('aside'));
    await f.tick();
    assert.equal(measurements, 0, 'chat text, attributes and unrelated body children cannot trigger fit');
    stack.querySelector('section[aria-label="Queued messages"] header button')!.textContent = '3';
    await f.tick();
    assert.ok(measurements > 0, 'native queue text still triggers fit');
    assert.match(stack.querySelector('[data-bb-chat-ui-info-trigger="queue"]')!.getAttribute('aria-label')!, /3/);
  } finally { stop(); f.dom.window.close(); }
});

test("rendered info controls do not feed their own mutations back into fit", async () => {
  const f = fixture();
  const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  let measurements = 0;
  stack.getBoundingClientRect = () => { measurements++; return { width:900 } as DOMRect; };
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick(); measurements = 0;
    const count = stack.querySelector('[data-bb-chat-ui-info-count]')!;
    const all = stack.querySelector('[data-bb-chat-ui-info-all]')!;
    count.textContent = '+12';
    all.setAttribute('aria-label', '전체 정보 · 펼침 중');
    all.setAttribute('title', '펼침 중');
    stack.querySelector('[data-bb-chat-ui-info-trigger="goal"]')!.setAttribute('aria-expanded', 'true');
    await f.tick(); await f.tick();
    assert.equal(measurements, 0, 'stack fan counts and control labels are rendered output, not new layout input');

    stack.querySelector('section[aria-label="Queued messages"] header button')!.textContent = '3';
    await f.tick();
    assert.ok(measurements > 0, 'native queue changes still update and fit');
    assert.match(stack.querySelector('[data-bb-chat-ui-info-trigger="queue"]')!.getAttribute('aria-label')!, /3/);
    f.click('[data-bb-chat-ui-info-trigger="goal"]'); await f.tick();
    assert.equal(stack.querySelector('section[aria-label="Goal"]')!.getAttribute('data-bb-chat-ui-info-open'), 'goal', 'native popover opening remains observable');
    f.click('[data-bb-chat-ui-info-dismiss]'); await f.tick();
    assert.equal(stack.querySelector('section[aria-label="Goal"]')!.hasAttribute('data-bb-chat-ui-info-open'), false);
  } finally { stop(); f.dom.window.close(); }
});

test("fitting reveals all candidate pills before reading their widths", async () => {
  const f = fixture();
  const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  const observers: { targets:Set<Element>; callback:() => void }[] = [];
  class RecordingResizeObserver {
    targets = new Set<Element>();
    callback: () => void;
    constructor(callback:() => void) { this.callback = callback; observers.push(this); }
    observe(node:Element) { this.targets.add(node); }
    unobserve(node:Element) { this.targets.delete(node); }
    disconnect() { this.targets.clear(); }
  }
  f.dom.window.ResizeObserver = RecordingResizeObserver as unknown as typeof ResizeObserver;
  stack.getBoundingClientRect = () => ({ width:100 } as DOMRect);
  Object.defineProperty(f.dom.window.HTMLElement.prototype, "offsetWidth", { configurable:true, get() { return this.hasAttribute("data-bb-chat-ui-info-trigger") ? 80 : 0; } });
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    const buttons = [...stack.querySelectorAll<HTMLButtonElement>('[data-bb-chat-ui-info-trigger]')];
    assert.ok(buttons.some(button => button.hidden), 'a narrow row starts with folded candidates');
    const reads: boolean[] = [];
    for (const button of buttons) Object.defineProperty(button, 'offsetWidth', {
      configurable:true, get() { reads.push(buttons.every(candidate => !candidate.hidden)); return 80; },
    });
    const resize = observers.find(observer => observer.targets.has(stack));
    assert.ok(resize); resize.callback();
    assert.equal(reads.length, buttons.length, 'each candidate is measured once');
    assert.ok(reads.every(Boolean), 'visibility writes cannot interleave with candidate width reads');
    assert.ok(buttons.some(button => button.hidden), 'fit still folds the overflow after measuring');
  } finally { stop(); f.dom.window.close(); }
});

test("late nested composers and device markers still trigger discovery and removal cleanup", async () => {
  const f = fixture();
  const shell = f.document.querySelector<HTMLElement>('[data-promptbox-shell]')!;
  shell.remove();
  const stop = injectComposerInfo(f.document);
  try {
    const wrapper = f.document.createElement('div'); wrapper.append(shell); f.document.body.append(wrapper);
    await f.tick();
    const stack = shell.querySelector<HTMLElement>('.grid')!;
    assert.ok(stack.querySelector('[data-bb-chat-ui-info-bar]'));
    let measurements = 0;
    stack.getBoundingClientRect = () => { measurements++; return { width:900 } as DOMRect; };
    const marker = f.document.createElement('span');
    marker.setAttribute('data-bb-chat-ui-device', 'phone'); f.document.body.append(marker);
    await f.tick(); assert.ok(measurements > 0);
    measurements = 0; marker.setAttribute('data-bb-chat-ui-device', 'desktop');
    await f.tick(); assert.ok(measurements > 0);
    measurements = 0; marker.removeAttribute('data-bb-chat-ui-device');
    await f.tick(); assert.ok(measurements > 0, 'device marker attribute removal also invalidates');
    wrapper.remove(); await f.tick();
    assert.equal(stack.hasAttribute('data-bb-chat-ui-info-stack'), false);
    assert.equal(stack.querySelector('[data-bb-chat-ui-info-bar]'), null);
  } finally { stop(); f.dom.window.close(); }
});

test("fresh native cards stay hidden before the next frame without hiding requests or open details", async () => {
  const f = fixture();
  const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  const stop = injectComposerInfo(f.document);
  try {
    const previous = stack.querySelector('section[aria-label="Goal"]')!;
    const goal = previous.cloneNode(true) as HTMLElement;
    goal.removeAttribute('data-bb-chat-ui-info-unit'); goal.removeAttribute('data-bb-chat-ui-info-open');
    previous.replaceWith(goal);
    assert.equal(resolvedStyle(goal).display, 'none', 'replacement cannot paint a native card before marking');
    const plugin = f.document.createElement('div'); plugin.textContent = 'new plugin notice'; stack.append(plugin);
    assert.equal(resolvedStyle(plugin).display, 'none', 'new unknown banner also waits for classification');
    const request = f.document.createElement('section'); request.innerHTML = '<div data-testid="user-question-banner">Question<button>Answer</button></div>';
    stack.append(request);
    // Marker updates run at the mutation checkpoint, before paint and without
    // waiting for the animation frame that classifies ordinary cards.
    await Promise.resolve(); await Promise.resolve();
    assert.notEqual(resolvedStyle(request).display, 'none', 'request wrapper stays visible immediately');
    assert.notEqual(resolvedStyle(request.firstElementChild!).display, 'none');
    request.remove(); await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="goal"]');
    assert.notEqual(resolvedStyle(goal).display, 'none', 'selected detail still opens');
    const shell = f.document.querySelector('[data-promptbox-shell]')!.cloneNode(true) as HTMLElement;
    for (const node of [shell, ...shell.querySelectorAll('*')]) {
      node.removeAttribute('data-bb-chat-ui-info-stack'); node.removeAttribute('data-bb-chat-ui-info-wrap');
      node.removeAttribute('data-bb-chat-ui-info-unit'); node.removeAttribute('data-bb-chat-ui-info-open');
    }
    shell.querySelector('[data-bb-chat-ui-info-bar]')!.remove(); f.document.body.append(shell);
    await Promise.resolve(); await Promise.resolve();
    const freshGoal = shell.querySelector('section[aria-label="Goal"]')!;
    assert.equal(resolvedStyle(freshGoal).display, 'none', 'a new composer with a bridge is guarded before mounting');
    shell.remove();
    stop();
    assert.notEqual(resolvedStyle(goal).display, 'none', 'unload restores native rendering');
    assert.notEqual(resolvedStyle(plugin).display, 'none');
  } finally { stop(); f.dom.window.close(); }
});

test("a settings bridge gap suspends the row without restoring native cards or stale actions", async () => {
  const f = fixture();
  const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  const source = stack.querySelector('[data-bb-chat-ui-info-settings]')!;
  const parent = source.parentElement!;
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick();
    const bar = stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!;
    const goal = stack.querySelector('section[aria-label="Goal"]')!;
    f.click('[data-bb-chat-ui-info-trigger="goal"]'); source.remove();
    assert.equal(resolvedStyle(bar).visibility, 'hidden', 'stale controls disappear before the next frame');
    assert.equal(resolvedStyle(goal).display, 'none', 'even an open detail hides immediately');
    await f.tick(); await f.tick();
    assert.equal(stack.querySelector('[data-bb-chat-ui-info-bar]'), bar, 'brief bridge gaps keep the managed row');
    assert.equal(bar.inert, true); assert.equal(bar.getAttribute('aria-hidden'), 'true');
    assert.equal(goal.hasAttribute('data-bb-chat-ui-info-open'), false);
    assert.equal(resolvedStyle(goal).display, 'none');
    assert.equal(f.document.querySelector('textarea')!.value, 'keep draft');
    const request = f.document.createElement('section'); request.setAttribute('data-testid', 'approval-banner');
    request.innerHTML = '<button>Approve</button>'; stack.append(request); await f.tick();
    assert.notEqual(resolvedStyle(request).display, 'none', 'a request remains usable during a bridge gap');
    assert.equal(resolvedStyle(f.document.querySelector('[data-follow-up-composer-anchor]')!).display, 'none', 'request priority still hides the editor');
    request.remove(); await f.tick();
    parent.append(source); await f.tick();
    assert.equal(bar.inert, false, 'same-thread bridge restoration also resumes the row');
    source.remove(); await f.tick();
    source.setAttribute('data-bb-chat-ui-info-thread', 'replacement-thread');
    parent.append(source); await f.tick();
    assert.equal(stack.querySelector('[data-bb-chat-ui-info-bar]'), bar);
    assert.equal(bar.inert, false); assert.equal(bar.hasAttribute('aria-hidden'), false);
    assert.notEqual(resolvedStyle(bar).visibility, 'hidden');
    f.click('[data-bb-chat-ui-info-trigger="goal"]');
    assert.notEqual(resolvedStyle(goal).display, 'none');
    source.remove(); await f.tick(); stop();
    assert.notEqual(resolvedStyle(goal).display, 'none', 'unload during a gap restores the host');
  } finally { stop(); f.dom.window.close(); }
});

function pointer(f: ReturnType<typeof fixture>, type: 'pointerover' | 'pointerout', target: Element, relatedTarget: Element | null = null, pointerType = 'mouse') {
  const event = new f.dom.window.MouseEvent(type, { bubbles:true, relatedTarget });
  Object.defineProperty(event, 'pointerType', { value:pointerType });
  target.dispatchEvent(event);
}

test("every empty detail has its family icon before the title while the full catalog has none", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const source = stack.querySelector('[data-bb-chat-ui-info-settings]')!;
  for (const node of [...stack.children]) if (!node.contains(source)) node.remove();
  for (const kind of infoKinds) source.insertAdjacentHTML('beforeend', `<span data-bb-chat-ui-info-icon="${kind.key}"><svg data-family="${kind.key}" /></span>`);
  const stop = injectComposerInfo(f.document);
  try {
    for (const kind of infoKinds) {
      f.click('[data-bb-chat-ui-info-all]');
      assert.equal(f.document.querySelector('[data-bb-chat-ui-info-menu] header [data-bb-chat-ui-info-title-icon]'), null);
      f.click(`[data-bb-chat-ui-info-choice="${kind.key}"]`);
      const heading = f.document.querySelector('[data-bb-chat-ui-info-menu] header')!;
      assert.ok(heading.firstElementChild?.matches(`[data-bb-chat-ui-info-title-icon="${kind.key}"]`), kind.key);
      assert.ok(heading.firstElementChild?.querySelector(`[data-family="${kind.key}"]`));
      assert.equal(heading.firstElementChild?.getAttribute('aria-hidden'), 'true');
      const css = resolvedStyle(heading.firstElementChild!);
      assert.equal(css.width, '14px'); assert.equal(css.height, '14px');
      f.click('[data-bb-chat-ui-info-close]');
    }
    f.click('[data-bb-chat-ui-info-all]'); f.click('[data-bb-chat-ui-info-choice="plan"]');
    source.querySelector('[data-bb-chat-ui-info-icon="plan"]')!.innerHTML = '<svg data-family="plan-updated" />';
    await f.tick();
    assert.ok(f.document.querySelector('header [data-bb-chat-ui-info-title-icon="plan"] [data-family="plan-updated"]'), 'late SDK artwork updates an open title');
  } finally { stop(); f.dom.window.close(); }
});

test("native and custom card titles use one family icon without changing native actions", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const source = stack.querySelector('[data-bb-chat-ui-info-settings]')!;
  for (const kind of infoKinds) source.insertAdjacentHTML('beforeend', `<span data-bb-chat-ui-info-icon="${kind.key}"><svg data-family="${kind.key}" /></span>`);
  const goal = stack.querySelector('section[aria-label="Goal"]')!;
  goal.querySelector('button[aria-expanded]')!.insertAdjacentHTML('afterbegin', '<svg data-native-goal />');
  const clear = goal.querySelector('[aria-label="Clear active Goal"]')!;
  clear.innerHTML = '<svg data-clear-icon />Clear';
  let cleared = 0; clear.addEventListener('click', () => cleared++);
  stack.insertAdjacentHTML('beforeend', '<section data-bb-chat-ui-info-kind="children"><h3><svg data-native-child />Child Threads<button data-bb-chat-ui-info-dismiss>×</button></h3><div>Child</div></section><div class="agentation-staging-shell"><div><div><svg data-icon="ChatFeedback" /><p>Annotations</p><button aria-expanded="true" aria-label="Collapse staged annotations">×</button></div><div><button>Send all</button></div></div><div class="grid"><div><div><ul><li>Feedback</li></ul></div></div></div></div>');
  const nativeGoal = goal.querySelector('[data-native-goal]')!;
  const nativeParent = nativeGoal.parentElement;
  const stop = injectComposerInfo(f.document);
  try {
    for (const key of ['goal','children','annotations','queue','diff']) {
      f.click('[data-bb-chat-ui-info-all]'); f.click(`[data-bb-chat-ui-info-choice="${key}"]`);
      await f.tick();
      const heading = f.document.querySelector(`[data-bb-chat-ui-info-title-heading="${key}"]`)!;
      assert.ok(heading, key);
      assert.ok(heading.firstElementChild?.matches(`[data-bb-chat-ui-info-title-icon="${key}"]`), key);
      assert.equal(heading.querySelectorAll('[data-bb-chat-ui-info-title-icon]').length, 1);
      if (key === 'goal') {
        assert.equal(resolvedStyle(nativeParent!).display, 'none');
        assert.equal(nativeGoal.parentElement, nativeParent);
        assert.ok(clear.querySelector('[data-bb-chat-ui-info-goal-clear-label]'), 'Goal removal stays a separate named action');
        (clear as HTMLButtonElement).click(); assert.equal(cleared, 1);
      }
    }
  } finally { stop(); }
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-title-icon]'), null);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-title-heading]'), null);
  assert.notEqual(resolvedStyle(nativeGoal).display, 'none');
  f.dom.window.close();
});

test("SDK Goal reuses its shared heading and keeps the body below it without native action columns", async () => {
  const f=fixture(),source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.insertAdjacentHTML('beforeend','<span data-bb-chat-ui-info-icon="goal"><svg /></span>');
  f.document.querySelector('section[aria-label="Goal"]')!.remove();
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML('beforeend','<div data-bb-chat-ui-info-supplements><section data-bb-chat-ui-info-kind="goal" aria-label="Goal"><h3 data-bb-chat-ui-card-head><span data-bb-chat-ui-card-icon><svg /></span><span data-bb-chat-ui-card-title>Goal</span></h3><div data-bb-chat-ui-card-body><p>A long SDK Goal objective that must use the card width.</p><p>complete · 1234 tokens · 90s</p></div></section></div>');
  const card=stack.querySelector('[data-bb-chat-ui-info-kind="goal"]')!,head=card.querySelector('h3')!,body=card.querySelector('[data-bb-chat-ui-card-body]')!;
  const stop=injectComposerInfo(f.document),css=(node:Element)=>resolvedStyle(node);
  try {
    for(let pass=0;pass<2;pass++){
      f.click('[data-bb-chat-ui-info-trigger="goal"]');await f.tick();
      assert.equal(card.querySelectorAll('[data-bb-chat-ui-card-head]').length,1,'the SDK heading is not duplicated');
      assert.equal(card.querySelector('h3'),head,'reuse the React-owned heading');
      assert.equal(css(card).display,'block','SDK content must not fall into native Goal action columns');
      assert.equal(css(card).gridTemplateColumns,'none');
      assert.equal(css(head).marginBottom,"10px",'the common title/body gap remains');
      assert.equal(css(head).paddingRight,"34px",'the common close-button gutter remains');
      assert.equal(body.previousElementSibling,head);
      assert.equal(body.parentElement,card);
      assert.equal(card.querySelectorAll('[data-bb-chat-ui-card-close]').length,1);
      f.click('[data-bb-chat-ui-card-close]');await f.tick();
      assert.equal(card.querySelector('h3'),head,'closing does not remove the SDK heading');
    }
  } finally {stop();}
  assert.equal(card.querySelector('h3'),head);
  assert.equal(head.hasAttribute('data-bb-chat-ui-card-head'),true,'unload preserves the SDK slot');
  assert.equal(body.hasAttribute('data-bb-chat-ui-card-body'),true);
  assert.equal(card.querySelectorAll('h3').length,1);
  assert.equal(card.querySelector('[data-bb-chat-ui-card-close]'),null);
  f.dom.window.close();
});

test("Goal keeps its native removal action beside the title and close without reparenting", async () => {
  const f=fixture();
  const goal=f.document.querySelector<HTMLElement>('section[aria-label="Goal"]')!;
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.insertAdjacentHTML('beforeend','<span data-bb-chat-ui-info-icon="goal"><svg data-family="goal" /></span>');
  const nativeStyle=f.document.createElement('style');
  nativeStyle.textContent='[aria-label="Goal controls"] { background:red; box-shadow:0 0 0 1px blue; border:1px solid blue; } #thread-goal-card-body { border-top:1px solid blue; } #thread-goal-card-body > div { background:red; }';
  f.document.head.append(nativeStyle);
  goal.innerHTML='<div role="group" aria-label="Goal controls"><button id="thread-goal-card-toggle" aria-expanded="false" aria-controls="thread-goal-card-body" aria-label="Goal"><svg data-native-title /><span>Goal</span></button><button aria-label="Clear active Goal"><svg data-native-clear /></button></div><section id="thread-goal-card-body" hidden><div class="overflow-hidden bg-popover"><div class="space-y-2 px-3 pb-2.5 pt-2"><p>Build a small demo</p><div>100 tokens · 12s</div></div><div><button aria-label="Collapse Goal" aria-controls="thread-goal-card-body">Collapse</button></div></div></section>';
  const toggle=goal.querySelector<HTMLButtonElement>('#thread-goal-card-toggle')!;
  const clear=goal.querySelector<HTMLButtonElement>('[aria-label="Clear active Goal"]')!;
  const clearParent=clear.parentElement;
  const body=goal.querySelector<HTMLElement>('#thread-goal-card-body')!;
  let removed=0;
  clear.addEventListener('click',()=>removed++);
  toggle.addEventListener('click',()=>{const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));body.hidden=!expanded;});
  const stop=injectComposerInfo(f.document);
  const style=(node:Element)=>resolvedStyle(node);
  try {
    f.click('[data-bb-chat-ui-info-trigger="goal"]');
    const title=goal.querySelector('h3[data-bb-chat-ui-info-close-heading]')!;
    assert.ok(title,'a regular popup title replaces the native split controls strip');
    assert.equal(title.textContent,'Goal');
    assert.ok(title.firstElementChild?.matches('[data-bb-chat-ui-info-title-icon="goal"]'));
    assert.equal(style(toggle).display,'none');
    assert.equal(style(clearParent!).backgroundColor,'rgba(0, 0, 0, 0)');
    assert.equal(style(clearParent!).boxShadow,'none');
    assert.equal(style(body).borderTopWidth,'0px');
    assert.equal(style(body.firstElementChild!).backgroundColor,'rgba(0, 0, 0, 0)');
    assert.equal(style(goal).display,'grid');
    assert.equal(style(goal).gridTemplateAreas,'"heading actions close" "body body body"');
    assert.equal(style(clearParent!).gridArea,'actions','Goal removal belongs beside the title');
    assert.equal(style(clearParent!).marginTop,'0px');
    assert.equal(style(title).gridArea,'heading');
    assert.equal(style(title).paddingRight,'0px','the empty close column reserves the gutter');
    assert.equal(style(body).gridArea,'body');
    const dismiss=goal.querySelector('[aria-label="Goal 닫기"]')!;
    assert.equal(style(dismiss).position,'absolute','the shared close sits on the card');
    assert.equal(style(dismiss).top,"17px",'centered on the 28px head line');
    assert.equal(style(clear).height,"24px",'Goal 해제 is the shared text action');
    assert.equal(style(clear).borderTopWidth,'1px');
    assert.equal(style(goal).alignItems,'center');
    assert.equal(clear.textContent,'해제');
    assert.ok(clear.hasAttribute('data-bb-chat-ui-card-end-action'));
    assert.equal(style(clear.querySelector('svg')!).display,'none','removal no longer looks like another popup close button');
    assert.equal(clear.parentElement,clearParent);
    assert.equal(goal.querySelectorAll('[aria-label="Goal 닫기"]').length,1);
    f.click('[aria-label="Goal 닫기"]');
    assert.equal(removed,0,'closing the popup does not remove the Goal');
    assert.equal(clear.querySelector('[data-bb-chat-ui-info-goal-clear-label]'),null,'closing restores native removal chrome');
    f.click('[data-bb-chat-ui-info-trigger="goal"]');
    clear.innerHTML='<svg data-native-clear />'; await f.tick();
    assert.equal(clear.textContent,'해제','native icon rerender restores the short action label');
    clear.disabled=true; await f.tick();
    assert.equal(clear.textContent,'해제 중…');
    clear.disabled=false; await f.tick();
    clear.click(); assert.equal(removed,1,'the original removal handler remains intact');
  } finally {stop();}
  assert.equal(goal.querySelector('[data-bb-chat-ui-info-goal-clear-label]'),null);
  assert.equal(goal.querySelector('h3'),null);
  assert.notEqual(style(toggle).display,'none');
  assert.equal(style(clearParent!).backgroundColor,'rgb(255, 0, 0)');
  assert.equal(style(body.firstElementChild!).backgroundColor,'rgb(255, 0, 0)');
  f.dom.window.close();
});

test("queue and list cards share the same horizontal content gutter as their headers", () => {
  const f=fixture();
  const style=f.document.createElement('style'); style.textContent=queuedMessagesCss; f.document.head.append(style);
  f.document.querySelector('[data-promptbox-shell] > .grid')!.insertAdjacentHTML('beforeend', '<section data-bb-chat-ui-info-kind="children"><h3>Child Threads</h3><div><button data-bb-chat-ui-info-child-row><span data-bb-chat-ui-info-avatar>Child</span></button></div></section><div class="agentation-staging-shell"><div><div><p>Annotations</p><button aria-label="Collapse staged annotations">Close</button></div><div></div></div><div class="grid"><div><div><ul><li>Feedback</li></ul></div></div></div></div>');
  f.document.querySelector('[data-queued-messages-scroll-frame]')!.innerHTML='<div data-queued-messages-scroll><div data-queued-message-row>Message</div></div>';
  const stop=injectComposerInfo(f.document);
  const gutters:number[]=[];
  try {
    for (const [key,rowSelector] of [['children','[data-bb-chat-ui-info-child-row]'],['annotations','li'],['queue','[data-queued-message-row]']]) {
      f.click('[data-bb-chat-ui-info-all]'); f.click(`[data-bb-chat-ui-info-choice="${key}"]`);
      const card=f.document.querySelector('[data-bb-chat-ui-info-open]')!;
      const outer=resolvedStyle(card);
      const row=resolvedStyle(card.querySelector(rowSelector)!);
      const inset=(value:string)=>parseFloat(value)||0;
      const scroll=card.querySelector('[data-queued-messages-scroll]');
      const frame=card.querySelector('[data-queued-messages-scroll-frame]');
      const gutter=inset(outer.paddingLeft)+inset(row.marginLeft)+inset(row.paddingLeft)+(scroll?inset(resolvedStyle(scroll).paddingLeft):0)+(frame?inset(resolvedStyle(frame).marginLeft):0);
      assert.equal(gutter,inset(outer.paddingLeft),`${key}: body starts at the same inset as its header`);
      assert.equal(outer.paddingLeft,outer.paddingRight,'left and right card gutters match');
      if (key === 'queue') assert.equal(resolvedStyle(card.querySelector('[data-bb-chat-ui-info-close-heading]')!).marginBottom,"10px",'queue uses the common title-to-body gap');
      gutters.push(gutter);
    }
    assert.equal(new Set(gutters).size,1,'the queue does not get an extra horizontal gutter');
  } finally {stop(); f.dom.window.close();}
});

test("native card layout padding does not add another indent inside managed popovers", () => {
  const f=fixture();
  const style=f.document.createElement('style');
  style.textContent='.p-1 { padding:4px; } .px-2 { padding-left:8px; padding-right:8px; } .px-3 { padding-left:12px; padding-right:12px; } .px-2\\.5 { padding-left:10px; padding-right:10px; } .py-1 { padding-top:4px; padding-bottom:4px; } .ml-4 { margin-left:16px; }';
  f.document.head.append(style);
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const context=f.document.querySelector('section[aria-label="Thread context before sending"]')!;
  context.innerHTML='<div class="flex items-center p-1"><div class="flex min-h-6 px-2 py-1"><svg data-layout-start></svg><span>Parent <a href="/threads/parent">Parent title</a></span></div></div>';
  for (const [kind,label] of [['plan','Prompt mode'],['goal','Goal'],['todos','To-do list'],['workflow','Workflow'],['background','Background commands'],['machine','Machine status'],['status','Thread history'],['fallback','Model fallback']]) {
    stack.querySelector(`section[aria-label="${label}"]`)?.remove();
    const card=f.document.createElement('section'); card.setAttribute('aria-label',label);
    const body=kind==='todos'
      ? '<ul class="px-2.5"><li class="px-2 py-1"><svg data-layout-start></svg><span>Item</span></li></ul>'
      : '<div class="px-3 py-1"><span data-layout-start>Details</span><div class="ml-4">Nested phase</div><button class="px-3">Action</button></div>';
    const inlay=kind==='machine'||kind==='status';
    card.innerHTML=`<div class="${inlay?'p-1':''}"><button ${kind==='machine'?'id="machine-status-toggle"':''} class="${inlay?'px-2':'px-3'}" aria-expanded="false" aria-controls="layout-${kind}">${label}</button></div><div id="layout-${kind}" hidden><div>${body}</div></div>`;
    const toggle=card.querySelector('button')!;
    toggle.addEventListener('click',()=>{ const expanded=toggle.getAttribute('aria-expanded')!=='true'; toggle.setAttribute('aria-expanded',String(expanded)); card.querySelector<HTMLElement>(`#layout-${kind}`)!.hidden=!expanded; });
    stack.append(card);
  }
  const stop=injectComposerInfo(f.document);
  const getStyle=(node:Element)=>resolvedStyle(node);
  try {
    for (const kind of ['parent','plan','goal','todos','workflow','background','machine','status','fallback']) {
      f.click('[data-bb-chat-ui-info-all]'); f.click(`[data-bb-chat-ui-info-choice="${kind}"]`);
      const card=f.document.querySelector('[data-bb-chat-ui-info-open]')!;
      let left=0,right=0;
      for (let node=card.querySelector('[data-layout-start]')!.parentElement!; node!==card; node=node.parentElement!) {
        const css=getStyle(node);
        left+=(parseFloat(css.paddingLeft)||0)+(parseFloat(css.marginLeft)||0);
        right+=(parseFloat(css.paddingRight)||0)+(parseFloat(css.marginRight)||0);
      }
      assert.equal(left,0,`${kind}: body begins at the common card gutter`);
      assert.equal(right,0,`${kind}: no extra right inset`);
      const toggle=card.querySelector('button[aria-controls]');
      if(toggle) {
        assert.equal(getStyle(toggle).paddingLeft,'0px',`${kind}: header begins at the common card gutter`);
        if(toggle.parentElement!==card) assert.equal(parseFloat(getStyle(toggle.parentElement!).paddingLeft)||0,0,'header wrapper does not reintroduce an inset');
      }
      const heading=card.querySelector('[data-bb-chat-ui-info-close-heading]');
      if(heading) {
        assert.equal(getStyle(heading).paddingRight,kind==='goal'?'0px':'34px','the close keeps either an empty grid column or the head gutter');
        assert.equal(getStyle(card.querySelector('[data-bb-chat-ui-info-native-dismiss]')!).top,"17px",`${kind}: one close position`);
      }
      const nested=card.querySelector('.ml-4');
      if(nested) assert.equal(getStyle(nested).marginLeft,'16px','nested phase indentation remains');
      const action=card.querySelector('button.px-3:not([aria-controls])');
      if(action) assert.equal(getStyle(action).paddingLeft,"12px",'actual action button padding remains');
    }
    stop();
    assert.equal(getStyle(context.querySelector('.p-1')!).paddingLeft,'4px','unload restores the native context inset');
    assert.equal(getStyle(context.querySelector('.px-2')!).paddingLeft,"8px",'unload restores the native segment inset');
  } finally { stop(); f.dom.window.close(); }
});

test("popover headings stay flat on focus while background rows gain an inset without changing their cursor", () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const card = f.document.createElement('section');
  card.setAttribute('aria-label', 'Background commands');
  card.innerHTML = '<div><button id="thread-background-commands-card-toggle" aria-expanded="false" aria-controls="thread-background-commands-card-body" class="bg-background/70">Running 3 background activities</button></div><section id="thread-background-commands-card-body" role="region" hidden><div><div><div class="flex min-w-0 px-3" style="cursor:text">npm test</div></div></div></section>';
  const toggle = card.querySelector<HTMLButtonElement>('button')!;
  const body = card.querySelector<HTMLElement>('section')!;
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded)); body.hidden = !expanded;
  });
  stack.append(card);
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="background"]');
    const paintRule=Array.from(f.document.styleSheets).flatMap(sheet=>Array.from(sheet.cssRules)).find(rule=>'selectorText' in rule && String(rule.selectorText).includes('#thread-background-commands-card-body') && rule.cssText.includes(':hover')) as CSSStyleRule;
    assert.ok(paintRule);
    // jsdom drops color-mix declarations; validate the face in the source too.
    assert.ok(composerInfoCss.includes(`${paintRule.selectorText} { background-color:color-mix(in oklab,var(--foreground) 6%,transparent) !important; }`));
    assert.equal(toggle.matches(paintRule.selectorText.replaceAll(':hover','')),false,'decorative row paint must exclude the heading subtree');
    assert.equal(body.querySelector('div.px-3')!.matches(paintRule.selectorText.replaceAll(':hover','')),true,'the complete body row owns the hover paint');
    toggle.focus();
    const header = resolvedStyle(toggle);
    assert.ok(['transparent', 'rgba(0, 0, 0, 0)'].includes(header.backgroundColor), 'the title focus/hover rule must not paint a second face');
    const row = resolvedStyle(body.querySelector('div.px-3')!);
    assert.equal(row.borderRadius, "8px");
    assert.equal(row.paddingLeft, "4px");
    assert.equal(row.paddingRight, "4px");
    assert.equal(row.marginLeft, "-4px", 'padding and inset keep the text aligned with the heading');
    assert.equal(row.cursor, 'text', 'a decorative row hover must preserve its existing cursor');
    assert.equal(row.transition, 'background-color 150ms ease-out');
  } finally { stop(); f.dom.window.close(); }
});

test("a background row accordion shows only that task and closes again", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const card = f.document.createElement('section');
  card.setAttribute('aria-label', 'Background commands');
  card.innerHTML = '<div><button id="thread-background-commands-card-toggle" aria-expanded="false" aria-controls="thread-background-commands-card-body">Running 2 background commands</button></div><section id="thread-background-commands-card-body" role="region" hidden><div><div class="flex flex-col"><div class="flex min-w-0 px-3"><span title="npm test">npm test</span></div><div class="flex min-w-0 px-3"><span title="npm test">npm test</span></div><div class="flex min-w-0 px-3" style="cursor:text"><span title="build">build</span></div></div></div></section>';
  const toggle = card.querySelector<HTMLButtonElement>('button')!;
  const body = card.querySelector<HTMLElement>('section')!;
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    body.hidden = !expanded;
  });
  stack.append(card);
  const source = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-settings]')!;
  const stop = injectComposerInfo(f.document);
  const activities = [
    { id:'one', description:'npm test', lines:['실행 중','첫 번째'] },
    { id:'two', description:'npm test', lines:['실행 중','두 번째'] },
  ];
  try {
    publishInfoData(source, { ...readInfoData(source)!.value, background: activities });
    await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="background"]');
    await f.tick();
    const rows = Array.from(body.querySelectorAll<HTMLElement>('div.px-3'));
    assert.equal(rows[2].getAttribute('role'), null, 'a row without progress stays decorative');
    assert.equal(resolvedStyle(rows[2]).cursor, 'text');
    rows[0].click();
    assert.equal(rows[0].getAttribute('aria-expanded'), 'true');
    assert.equal(rows[0].nextElementSibling?.textContent, '실행 중첫 번째');
    rows[0].click();
    assert.equal(body.querySelector('[data-bb-chat-ui-info-activity-panel]'), null);
    rows[1].click();
    assert.equal(rows[0].getAttribute('aria-expanded'), 'false');
    assert.equal(rows[1].nextElementSibling?.textContent, '실행 중두 번째');
    publishInfoData(source, { ...readInfoData(source)!.value, background: [activities[0], { ...activities[1], lines:['완료','갱신'] }] });
    await f.tick();
    assert.equal(rows[1].nextElementSibling?.textContent, '완료갱신');
    assert.equal(body.querySelectorAll('[data-bb-chat-ui-info-activity-panel]').length, 1);
  } finally { stop(); }
  assert.equal(body.querySelector('[data-bb-chat-ui-info-activity]'), null);
  assert.equal(body.querySelector('[data-bb-chat-ui-info-activity-panel]'), null);
  f.dom.window.close();
});

test("popover entrance settles only the outer native disclosure and keeps inner transitions", () => {
  const f=fixture();
  const style=f.document.createElement('style');
  style.textContent='.native-disclosure { transition:grid-template-rows 200ms ease; grid-template-rows:0fr; opacity:0; } .agentation-disclosure { transition:grid-template-rows 500ms ease; grid-template-rows:0fr; }';
  f.document.head.append(style);
  const goal=f.document.querySelector('section[aria-label="Goal"]')!;
  goal.querySelector('#goal')!.outerHTML='<section id="goal" role="region" class="native-disclosure"><div class="native-disclosure" data-inner>Nested disclosure</div></section>';
  const agent=f.document.createElement('div');
  agent.className='agentation-staging-shell';
  agent.innerHTML='<div><button aria-expanded="false" aria-controls="agent-body">Agentation</button></div><div id="agent-body" class="grid agentation-disclosure"><div>Feedback</div></div>';
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(agent);
  const stop=injectComposerInfo(f.document);
  try {
    for(const kind of ['goal','annotations']) {
      f.click('[data-bb-chat-ui-info-all]'); f.click(`[data-bb-chat-ui-info-choice="${kind}"]`);
      const card=f.document.querySelector('[data-bb-chat-ui-info-open]')!;
      const body=card.querySelector(kind==='goal'?'#goal':'#agent-body')!;
      assert.equal(resolvedStyle(body).transition,'none','outer disclosure must not add a second entrance');
      assert.equal(resolvedStyle(body).gridTemplateRows,'1fr');
      assert.ok(resolvedStyle(card).animation.includes('bb-info-enter'),'shared popup entrance remains');
      if(kind==='goal')assert.equal(resolvedStyle(card.querySelector('[data-inner]')!).transition,'grid-template-rows 200ms ease','inner disclosure keeps its transition');
    }
    stop();
    assert.equal(resolvedStyle(goal.querySelector('#goal')!).transition,'grid-template-rows 200ms ease');
  } finally {stop(); f.dom.window.close();}
});

test("open info popovers keep one glass face and drop the native body slab, activity wash, and title-button blur", () => {
  const f = fixture();
  const utilities = f.document.createElement("style");
  utilities.textContent = [
    ".border-t { border-top-width:1px; border-top-style:solid; }",
    ".border-border { border-top-color:rgb(228, 228, 231); }",
    ".bg-popover { background-color:rgb(255, 255, 255); }",
    ".bg-background { background-color:rgb(200, 200, 200); }",
    ".bg-background\\/70 { background-color:rgba(250, 250, 250, 0.7); }",
    ".bg-destructive\\/5 { background-color:rgba(200, 0, 0, 0.05); }",
    ".bg-success\\/10 { background-color:rgba(0, 128, 0, 0.1); }",
    ".bg-foreground { background-color:rgb(10, 10, 10); }",
    ".text-destructive-text { color:rgb(180, 40, 40); }",
    ".px-3 { padding-left:12px; padding-right:12px; }",
    ".shadow-xs, .ring-1 { box-shadow:0 0 0 1px rgb(0, 0, 255); }",
    ".shadow-none, .ring-0 { box-shadow:none; }",
    "hr { border:0; border-top:1px solid rgb(1, 2, 3); }",
  ].join(" ");
  f.document.head.append(utilities);
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const goalBody = f.document.querySelector<HTMLElement>('#goal')!;
  goalBody.className = "overflow-hidden bg-popover";
  f.document.body.insertAdjacentHTML("beforeend", '<div id="timeline-decoy" class="bg-popover">timeline</div>');
  const activeRow = "rounded-md bg-background/70 px-2 py-1 shadow-none ring-0 flex min-w-0 items-center gap-2 text-xs";
  const failedRow = "rounded-md bg-destructive/5 px-2 py-1 ring-1 ring-destructive/20 flex min-w-0 items-center gap-2 text-xs";
  const headerWash = "bg-background/70 shadow-xs ring-1 ring-border/60 flex min-h-8 w-full min-w-0 items-center gap-1.5 rounded-none px-3 py-1.5 text-xs text-foreground";
  const region = (id: string, labelledBy: string, inner: string) =>
    `<section id="${id}" role="region" aria-labelledby="${labelledBy}" hidden class="grid overflow-hidden border-t border-border"><div class="overflow-hidden bg-popover">${inner}</div></section>`;
  const wire = (card: HTMLElement, button: string, bodyId: string) => {
    const toggle = card.querySelector<HTMLButtonElement>(button)!;
    const body = card.querySelector<HTMLElement>(`#${bodyId}`)!;
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      body.hidden = !expanded;
    });
    return { toggle, body };
  };
  const todos = stack.querySelector<HTMLElement>('section[aria-label="To-do list"]')!;
  todos.innerHTML = `<div class="flex items-center"><button type="button" id="thread-todo-card-toggle" aria-expanded="false" aria-controls="thread-todo-card-body" aria-label="To-do list: 0 of 2 items complete" class="${headerWash} cursor-pointer transition-colors hover:bg-background/80 group/disclosure"><span>0/2 complete</span></button></div>${region("thread-todo-card-body", "thread-todo-card-toggle", `<ul class="px-2.5"><li class="${activeRow}"><span class="text-foreground">Ship the card</span></li><li class="${failedRow}"><span class="text-destructive-text">Retry the check</span></li></ul>`)}`;
  const todoToggle = wire(todos, "#thread-todo-card-toggle", "thread-todo-card-body");
  const cards: Array<{ key: string; html: string; toggle: string; body: string }> = [
    {
      key: "background",
      toggle: "#thread-background-commands-card-toggle",
      body: "thread-background-commands-card-body",
      html: `<section aria-label="Background agents"><div class="flex items-center"><div class="${headerWash} cursor-default" aria-label="npm test"><span>npm test</span></div><button type="button" id="thread-background-commands-card-toggle" aria-expanded="false" aria-controls="thread-background-commands-card-body" aria-label="Background agents" class="${headerWash} cursor-pointer transition-colors hover:bg-background/80 group/disclosure"><span>Background agents</span></button></div>${region("thread-background-commands-card-body", "thread-background-commands-card-toggle", `<p>running command</p><pre class="bg-popover"><code class="bg-popover">echo hi</code></pre><input class="bg-background" value="edit"><textarea class="bg-background">draft</textarea><input data-protected="input" class="bg-background/70 ring-1" value="wash"><textarea data-protected="textarea" class="bg-destructive/5">bad</textarea><select data-protected="select" class="bg-background/70"><option>A</option></select><pre data-protected="pre" class="bg-destructive/5"><span data-protected="pre-child" class="bg-background/70">inside</span></pre><code data-protected="code" class="bg-background/70">snippet</code><div data-protected="editable" contenteditable="true" class="bg-destructive/5"><em data-protected="editable-child" class="bg-background/70">note</em></div><div class="cm-editor"><div data-protected="cm" class="cm-content bg-background/70">cm</div></div><div data-protected="monaco" class="monaco-editor bg-destructive/5"><span data-protected="monaco-child" class="bg-background/70 ring-1">mono</span></div><hr>`)}</section>`,
    },
    {
      key: "plan",
      toggle: "#thread-prompt-mode-card-toggle",
      body: "thread-prompt-mode-card-body",
      html: `<section aria-label="Prompt mode"><div role="group" aria-label="Plan mode controls" class="bg-background/70 shadow-xs ring-1 ring-border/60 flex w-full items-stretch rounded-none px-0 py-0"><button type="button" id="thread-prompt-mode-card-toggle" aria-expanded="false" aria-controls="thread-prompt-mode-card-body" aria-label="Plan" class="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-none bg-transparent px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-background/80 group/disclosure"><span>Plan</span></button><button type="button" aria-label="Exit plan mode" class="flex min-h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-none border-l border-border/35 bg-transparent"><svg data-plan-exit></svg></button></div>${region("thread-prompt-mode-card-body", "thread-prompt-mode-card-toggle", "<p>Plan steps</p>")}</section>`,
    },
    {
      key: "workflow",
      toggle: "#workflow-card-toggle",
      body: "workflow-card-body",
      html: `<section aria-label="Workflow"><button type="button" id="workflow-card-toggle" aria-expanded="false" aria-controls="workflow-card-body" aria-label="Workflow: Release" class="flex min-h-8 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-none px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-background/80 group/disclosure"><span>Release</span></button>${region("workflow-card-body", "workflow-card-toggle", `<div class="${activeRow}">Build</div><div class="${failedRow}"><span class="text-destructive-text">Publish failed</span></div><span class="bg-success/10">done</span><span class="bg-foreground" data-phase-dot></span>`)}</section>`,
    },
    {
      key: "machine",
      toggle: "#machine-status-toggle",
      body: "machine-status-body",
      html: `<section aria-label="Machine status"><div class="flex items-center gap-0.5 p-1"><button type="button" id="machine-status-toggle" aria-expanded="false" aria-controls="machine-status-body" aria-label="Machine is paused. Could not resume the machine." class="flex min-w-0 flex-1 cursor-pointer items-center justify-start gap-1.5 text-left text-xs transition-colors group/disclosure hover:bg-state-hover"><span>Machine is paused</span></button><div class="ml-auto flex shrink-0 items-center gap-1.5 pr-2 text-xs text-muted-foreground"><button type="button" class="inline-flex items-center whitespace-nowrap rounded border border-border px-1.5 py-0.5 text-xs bg-background shadow-xs">Retry</button></div></div>${region("machine-status-body", "machine-status-toggle", "<p>Could not resume the machine.</p>")}</section>`,
    },
    {
      key: "status",
      toggle: "#thread-prompt-banner-status-toggle",
      body: "thread-prompt-banner-status-body",
      html: `<section aria-label="Thread history"><button type="button" id="thread-prompt-banner-status-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-status-body" aria-label="Thread history" class="flex min-h-8 w-full cursor-pointer items-center rounded-none px-3 py-1.5 text-xs hover:bg-background/80"><span>History</span></button>${region("thread-prompt-banner-status-body", "thread-prompt-banner-status-toggle", "<p>Earlier turn</p>")}</section>`,
    },
  ];
  const bodies = new Map<string, { toggle: HTMLButtonElement; body: HTMLElement; card: HTMLElement }>();
  bodies.set("todos", { ...todoToggle, card: todos });
  for (const spec of cards) {
    stack.insertAdjacentHTML("beforeend", spec.html);
    const card = stack.querySelector<HTMLElement>(`section[aria-label="${spec.html.match(/aria-label="([^"]+)"/)![1]}"]`)!;
    bodies.set(spec.key, { ...wire(card, spec.toggle, spec.body), card });
  }
  const stop = injectComposerInfo(f.document);
  const paint = (node: Element) => resolvedStyle(node);
  const blurOf = (node: Element) => `${paint(node).backdropFilter} ${paint(node).getPropertyValue("-webkit-backdrop-filter")}`;
  const transparent = (value: string) => value === "rgba(0, 0, 0, 0)" || value === "transparent";
  const flatFace = (value: string) => transparent(value) || value === "color-mix(in oklab, var(--foreground) 6%, transparent)";
  const nativeWash = (value: string) => value === "rgba(250, 250, 250, 0.7)" || value === "rgba(200, 0, 0, 0.05)";
  let openCard: HTMLElement | null = null;
  try {
    for (const key of ["background", "plan", "todos", "workflow", "machine", "status"]) {
      f.click(`[data-bb-chat-ui-info-trigger="${key}"]`);
      const card = f.document.querySelector<HTMLElement>("[data-bb-chat-ui-info-open]")!;
      openCard = card;
      const slab = card.querySelector<HTMLElement>('section[role="region"] > div.bg-popover')!;
      const regionNode = slab.parentElement!;
      assert.equal(paint(card).backdropFilter.includes("blur(14px)") || paint(card).getPropertyValue("-webkit-backdrop-filter").includes("blur(14px)"), true, `${key}: the open popover keeps the outer glass`);
      assert.equal(paint(regionNode).borderTopWidth, "0px", `${key}: disclosure body has no separator line`);
      assert.equal(transparent(paint(slab).backgroundColor), true, `${key}: disclosure body has no second face`);
      assert.equal(paint(slab).boxShadow, "none", `${key}: disclosure body has no second shadow`);
      assert.equal(bodies.get(key)!.body.hidden, false, `${key}: opening still expands the native body`);
      const titleButton = card.querySelector<HTMLButtonElement>("button[aria-expanded][aria-controls]")!;
      assert.equal(blurOf(titleButton).includes("blur"), false, `${key}: header disclosure has no nested glass blur`);
      const flat = paint(titleButton).backgroundColor === "rgba(0, 0, 0, 0)" || paint(titleButton).backgroundColor === "transparent" || paint(titleButton).backgroundColor === "color-mix(in oklab, var(--foreground) 6%, transparent)";
      assert.equal(flat, true, `${key}: header disclosure drops the opaque native face`);
      assert.equal(paint(titleButton).backgroundColor === "rgba(250, 250, 250, 0.7)", false, `${key}: header disclosure drops the activity wash`);
      assert.equal(paint(titleButton).boxShadow, "none", `${key}: header disclosure has no native ring`);
      assert.equal(titleButton.getAttribute("aria-expanded"), "true", `${key}: expand control stays`);
    }
    const background = bodies.get("background")!.card;
    f.click('[data-bb-chat-ui-info-trigger="background"]');
    const single = background.querySelector<HTMLElement>('[aria-label="npm test"]')!;
    assert.equal(flatFace(paint(single).backgroundColor) && !nativeWash(paint(single).backgroundColor), true, "a single background header drops its active wash");
    assert.equal(paint(single).boxShadow, "none");
    assert.equal(single.textContent, "npm test");
    for (const label of ["Background agents", "Background commands", "Background activity"]) {
      background.setAttribute("aria-label", label);
      assert.equal(paint(background.querySelector("#thread-background-commands-card-toggle")!).paddingLeft, "0px", `${label}: header uses the common gutter`);
      assert.equal(paint(single).paddingLeft, "0px", `${label}: single-task header uses the common gutter`);
    }
    const code = background.querySelector("code")!;
    const field = background.querySelector("input")!;
    const editor = background.querySelector("textarea")!;
    assert.equal(paint(code).backgroundColor, "rgb(255, 255, 255)", "code preview keeps its face");
    assert.equal(paint(field).backgroundColor, "rgb(200, 200, 200)", "inputs keep their face");
    assert.equal(paint(editor).backgroundColor, "rgb(200, 200, 200)", "editors keep their face");
    const wash = "rgba(250, 250, 250, 0.7)";
    const failedWash = "rgba(200, 0, 0, 0.05)";
    const protectedFace = (name: string, color: string) => assert.equal(paint(background.querySelector(`[data-protected="${name}"]`)!).backgroundColor, color, `${name} keeps its own face`);
    protectedFace("input", wash);
    protectedFace("textarea", failedWash);
    protectedFace("select", wash);
    protectedFace("pre", failedWash);
    protectedFace("pre-child", wash);
    protectedFace("code", wash);
    protectedFace("editable", failedWash);
    protectedFace("editable-child", wash);
    protectedFace("cm", wash);
    protectedFace("monaco", failedWash);
    protectedFace("monaco-child", wash);
    assert.notEqual(paint(background.querySelector('[data-protected="input"]')!).boxShadow, "none", "a protected field keeps its own shadow");
    assert.notEqual(paint(background.querySelector('[data-protected="monaco-child"]')!).boxShadow, "none", "a protected editor descendant keeps its own shadow");
    assert.equal(paint(background.querySelector("hr")!).borderTopColor, "rgb(1, 2, 3)", "semantic dividers stay");
    f.click('[data-bb-chat-ui-info-trigger="plan"]');
    const controls = f.document.querySelector<HTMLElement>('[aria-label="Plan mode controls"]')!;
    assert.equal(flatFace(paint(controls).backgroundColor) && !nativeWash(paint(controls).backgroundColor), true, "plan controls drop the active wash");
    assert.equal(paint(controls).boxShadow, "none");
    assert.equal(controls.querySelector('[aria-label="Exit plan mode"]')!.querySelector("svg")!.getAttribute("data-plan-exit"), "", "plan exit stays in the card");
    f.click('[data-bb-chat-ui-info-trigger="todos"]');
    const todoCard = bodies.get("todos")!.card;
    const active = todoCard.querySelectorAll("li")[0]!;
    const failed = todoCard.querySelectorAll("li")[1]!;
    assert.equal(flatFace(paint(active).backgroundColor) && !nativeWash(paint(active).backgroundColor), true, "an active todo drops its wash");
    assert.equal(paint(active).boxShadow, "none");
    assert.equal(flatFace(paint(failed).backgroundColor) && !nativeWash(paint(failed).backgroundColor), true, "a failed todo drops its wash");
    assert.equal(paint(failed).boxShadow, "none");
    assert.equal(paint(failed.querySelector("span")!).color, "rgb(180, 40, 40)", "failed text keeps its status color");
    f.click('[data-bb-chat-ui-info-trigger="workflow"]');
    const workflow = bodies.get("workflow")!.card;
    const agent = workflow.querySelector("div.bg-background\\/70")!;
    assert.equal(flatFace(paint(agent).backgroundColor) && !nativeWash(paint(agent).backgroundColor), true, "an active workflow row drops its wash");
    assert.equal(paint(workflow.querySelector(".text-destructive-text")!).color, "rgb(180, 40, 40)");
    assert.equal(paint(workflow.querySelector(".bg-success\\/10")!).backgroundColor, "rgba(0, 128, 0, 0.1)", "status pills keep their color");
    assert.equal(paint(workflow.querySelector("[data-phase-dot]")!).backgroundColor, "rgb(10, 10, 10)", "phase dots keep their color");
    f.click('[data-bb-chat-ui-info-trigger="machine"]');
    const machineCard = bodies.get("machine")!.card;
    const retryButton = [...machineCard.querySelectorAll("button")].find(button => button.textContent === "Retry")!;
    const dismiss = machineCard.querySelector("[data-bb-chat-ui-info-native-dismiss]")!;
    let retried = 0;
    retryButton.addEventListener("click", () => retried++);
    // One surface: a native action inside a card sits flat on the face instead of a second glass.
    assert.equal(blurOf(retryButton).includes("blur("), false, "a small action adds no second glass");
    assert.equal(paint(retryButton).backgroundColor, "rgba(0, 0, 0, 0)", "a small action drops the opaque native fill");
    assert.equal(paint(retryButton).boxShadow, "none", "a small action drops the native ring");
    assert.ok(dismiss.hasAttribute("data-bb-chat-ui-card-close"));
    assert.equal(retryButton.textContent, "Retry");
    retryButton.click();
    assert.equal(retried, 1, "the native action click remains");
    retryButton.disabled = true;
    assert.equal(retryButton.disabled, true, "the native disabled state remains");
    retryButton.disabled = false;
    assert.equal(paint(goalBody).backgroundColor, "rgb(255, 255, 255)", "a closed card keeps its native face");
    assert.equal(paint(f.document.querySelector("#timeline-decoy")!).backgroundColor, "rgb(255, 255, 255)", "timeline cards outside the popover keep their face");
    const sheet = f.document.getElementById("bb-chat-ui-composer-info")!.textContent!;
    assert.match(sheet, /\[class~="bg-background\/70"\][\s\S]*:is\(:hover, :focus-visible\)/);
    assert.match(sheet, /color-mix\(in oklab, ?var\(--foreground\) 6%, ?transparent\)/);
    const backgroundToggle = bodies.get("background")!.toggle;
    f.click('[data-bb-chat-ui-info-trigger="background"]');
    backgroundToggle.click();
    assert.equal(bodies.get("background")!.body.hidden, false, "the read-only title cannot collapse the popover");
    assert.equal(background.querySelector("p")!.textContent, "running command");
    (background.querySelector('[data-bb-chat-ui-info-native-dismiss]') as HTMLButtonElement).click();
    assert.equal(bodies.get("background")!.body.hidden, true, "the close action still collapses the native disclosure");
    f.click('[data-bb-chat-ui-info-trigger="background"]');
    assert.equal(bodies.get("background")!.body.hidden, false, "the pill still expands the native disclosure");
    assert.equal(background.hasAttribute("data-bb-chat-ui-info-open"), true);
  } finally { stop(); }
  assert.equal(paint(openCard!.querySelector('section[role="region"] > div.bg-popover')!).backgroundColor, "rgb(255, 255, 255)", "unload restores the disclosure face");
  assert.equal(paint(openCard!.querySelector('section[role="region"]')!).borderTopWidth, "1px", "unload restores the disclosure line");
  assert.equal(paint(f.document.querySelector('[aria-label="Plan mode controls"]')!).backgroundColor, "rgba(250, 250, 250, 0.7)", "unload restores the activity wash");
  f.dom.window.close();
});

test("named native actions stay separate from popover close", async () => {
  const f = fixture();
  const utilities = f.document.createElement("style");
  utilities.textContent = ".border { border-width:1px; border-style:solid; } .border-border { border-color:rgb(9, 9, 9); } .bg-surface-raised-solid { background-color:rgb(20, 20, 20); } .bg-popover { background-color:rgb(255, 255, 255); } .bg-background\\/70 { background-color:rgba(250, 250, 250, 0.7); } .px-3 { padding-left:12px; padding-right:12px; }";
  f.document.head.append(utilities);
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML("beforeend", `
    <section aria-label="Prompt mode"><div aria-label="Plan mode controls"><button type="button" id="thread-prompt-mode-card-toggle" class="flex-1" aria-expanded="false" aria-controls="thread-prompt-mode-card-body" aria-label="Plan">Plan</button><button type="button" aria-label="Exit plan mode"><svg data-plan-exit></svg></button><button type="button">Open in side panel</button></div><section id="thread-prompt-mode-card-body" hidden><p>Plan steps</p></section></section>
    <section aria-label="Model fallback"><div role="status"><svg data-fallback-icon></svg><span class="font-medium">Model fallback</span><span title="Switched from Opus to Sonnet">Switched from Opus to Sonnet</span><button type="button" aria-label="Dismiss model fallback"><svg data-fallback-dismiss></svg></button></div></section>
    <section aria-label="Machine status"><div class="flex items-center gap-0.5 p-1"><button type="button" id="machine-status-toggle" aria-expanded="false" aria-controls="machine-status-body">Paused</button><div class="ml-auto flex shrink-0 items-center gap-1.5 pr-2"><button type="button">Retry</button></div></div><section id="machine-status-body" hidden><p>detail</p></section></section>
    <section aria-label="Workflow"><button type="button" id="workflow-card-toggle" aria-expanded="false" aria-controls="workflow-card-body">Release</button><div id="workflow-card-body" hidden><button type="button" data-phase="done" aria-expanded="false">코드 감사</button><button type="button" data-phase="active" class="bg-background/70" aria-expanded="false">화면 검증</button><button type="button" data-workflow-action>Retry</button></div></section>
  `);
  for (const toggle of stack.querySelectorAll<HTMLButtonElement>('button[aria-expanded]')) {
    if (toggle.getAttribute("data-wired") === "1") continue;
    toggle.setAttribute("data-wired", "1");
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      const body = f.document.getElementById(toggle.getAttribute("aria-controls") ?? "");
      if (body) body.hidden = !expanded;
    });
  }
  const context = stack.querySelector('section[aria-label="Thread context before sending"]')!;
  context.insertAdjacentHTML("beforeend", '<div class="inline-flex overflow-hidden rounded border border-border"><button type="button">Merge</button></div><input class="border border-border" value="keep">');
  const banner = stack.querySelector(".plugin-banner")!;
  banner.insertAdjacentHTML("afterbegin", '<h3 class="px-3">Other title</h3>');
  banner.insertAdjacentHTML("beforeend", '<div data-legacy class="bg-surface-raised-solid">legacy</div><div data-legacy-popover class="rounded border border-border bg-popover px-3"><p>note</p><pre class="bg-popover px-3"><code>keep</code></pre></div><input data-protected-other class="bg-surface-raised-solid" value="field"><pre class="bg-surface-raised-solid"><span data-protected-child class="bg-surface-raised-solid">snippet</span></pre>');
  let planExits = 0;
  let fallbackDismisses = 0;
  let retries = 0;
  let merges = 0;
  let phaseClicks = 0;
  stack.querySelector<HTMLButtonElement>('[aria-label="Exit plan mode"]')!.addEventListener("click", () => planExits++);
  stack.querySelector<HTMLButtonElement>('[aria-label="Dismiss model fallback"]')!.addEventListener("click", () => fallbackDismisses++);
  [...stack.querySelectorAll("button")].find(button => button.textContent === "Retry")!.addEventListener("click", () => retries++);
  [...context.querySelectorAll("button")].find(button => button.textContent === "Merge")!.addEventListener("click", () => merges++);
  stack.querySelector<HTMLButtonElement>('[data-phase="done"]')!.addEventListener("click", () => phaseClicks++);
  const stop = injectComposerInfo(f.document);
  const paint = (node: Element) => resolvedStyle(node);
  try {
    const sheet = f.document.getElementById("bb-chat-ui-composer-info")!.textContent!;
    // Native gutter resets never reach the head; the head reads its gutter from the shared card.
    assert.match(sheet, /> div\[class~="p-1"\]:not\(\[data-bb-chat-ui-card-head\]\)/);
    assert.match(sheet, /\[data-bb-chat-ui-card-head\] \{ [^}]*padding:0 var\(--bb-chat-ui-card-close-gutter\) 0 0 !important;/);
    f.click('[data-bb-chat-ui-info-trigger="plan"]');
    const exit = f.document.querySelector<HTMLButtonElement>('[aria-label="Exit plan mode"]')!;
    assert.equal(exit.textContent, "종료");
    assert.equal(paint(exit).marginLeft, "auto", "a state action follows the title's remaining space");
    const detail=exit.parentElement!.querySelector('[data-bb-chat-ui-info-panel-action]')!;
    assert.ok(detail,'a native controls row is reused even without a group role');
    assert.ok(detail.compareDocumentPosition(exit)&f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'detail navigation precedes the state action');
    assert.equal(paint(exit.parentElement!.querySelector('[data-bb-chat-ui-info-readonly-title]')!).flexGrow,'0','a read-only title does not push its detail action away');
    assert.equal(paint(exit.querySelector("svg")!).display, "none");
    assert.equal(paint(exit).getPropertyValue("backdrop-filter"), "none", "Plan 종료 is the shared hairline action, not a second glass");
    assert.equal(paint(exit).borderTopWidth, "1px");
    assert.equal(paint(exit).height, "24px");
    assert.equal(exit.parentElement, f.document.querySelector('[aria-label="Plan mode controls"]'));
    exit.click();
    assert.equal(planExits, 1);
    exit.disabled = true;
    await f.tick();
    assert.equal(exit.textContent, "종료 중…");
    f.click('[aria-label="Plan 닫기"]');
    assert.equal(planExits, 1, "popover close does not exit plan");
    f.click('[data-bb-chat-ui-info-trigger="fallback"]');
    const fallback = f.document.querySelector('section[aria-label="Model fallback"]')!;
    const message = fallback.querySelector("span[title]")!;
    assert.equal(message.getAttribute("title"), "Switched from Opus to Sonnet");
    assert.equal(message.textContent, "Switched from Opus to Sonnet");
    assert.notEqual(paint(message).display, "none", "the provider transition stays visible");
    assert.equal(paint(fallback.querySelector("span.font-medium")!).display, "none");
    assert.equal(paint(fallback.querySelector("[data-fallback-icon]")!).display, "none");
    const dismissFallback = fallback.querySelector<HTMLButtonElement>('[aria-label="Dismiss model fallback"]')!;
    assert.equal(dismissFallback.textContent, "해제");
    assert.equal(fallback.getAttribute('data-bb-chat-ui-card-layout'),'with-actions','a body-owned native action joins the title row without moving its node');
    assert.equal(paint(dismissFallback).gridArea,'actions');
    assert.equal(paint(dismissFallback.parentElement!).display,'contents');
    assert.equal(paint(dismissFallback.querySelector("svg")!).display, "none");
    dismissFallback.click();
    assert.equal(fallbackDismisses, 1);
    f.click('[aria-label="Model fallback 닫기"]');
    assert.equal(fallbackDismisses, 1, "popover close does not dismiss the fallback");
    f.click('[data-bb-chat-ui-info-trigger="machine"]');
    const retry = [...f.document.querySelectorAll("button")].find(button => button.textContent === "Retry")!;
    retry.click();
    assert.equal(retries, 1);
    assert.ok(f.document.querySelector('[aria-label="실행 환경 닫기"]'));
    f.click('[data-bb-chat-ui-info-trigger="pullRequest"]');
    const merge = context.querySelector<HTMLElement>("div.inline-flex.rounded")!;
    assert.equal(paint(merge).borderTopWidth, "0px", "the Merge group is text and caret only");
    assert.equal(paint(context.querySelector("input")!).borderTopWidth, "1px");
    context.querySelector<HTMLButtonElement>("div.inline-flex button")!.click();
    assert.equal(merges, 1);
    f.click('[data-bb-chat-ui-info-trigger="other"]');
    const other = stack.querySelector(".plugin-banner")!;
    assert.equal(paint(other.querySelector("[data-legacy]")!).backgroundColor, "rgba(0, 0, 0, 0)");
    const popoverWrap = other.querySelector<HTMLElement>("[data-legacy-popover]")!;
    assert.equal(paint(popoverWrap).backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(paint(popoverWrap).borderTopWidth, "0px");
    assert.equal(paint(popoverWrap).paddingLeft, "0px", "open Other drops the extra px-3 gutter");
    assert.equal(popoverWrap.querySelector("p")!.textContent, "note");
    const protectedCode = popoverWrap.querySelector("pre")!;
    assert.equal(paint(protectedCode).backgroundColor, "rgb(255, 255, 255)");
    assert.equal(paint(protectedCode).paddingLeft, "12px");
    assert.equal(protectedCode.textContent, "keep");
    assert.equal(paint(other.querySelector("[data-protected-other]")!).backgroundColor, "rgb(20, 20, 20)");
    assert.equal(paint(other.querySelector("[data-protected-child]")!).backgroundColor, "rgb(20, 20, 20)");
    assert.equal(paint(other.querySelector("pre.bg-surface-raised-solid")!).backgroundColor, "rgb(20, 20, 20)");
    const otherTitle = other.querySelector("h3.px-3")!;
    assert.equal(otherTitle.hasAttribute("data-bb-chat-ui-info-close-heading"), true);
    assert.equal(paint(otherTitle).paddingLeft, "0px", "open Other title lines up with the common gutter");
    assert.equal(paint(otherTitle).paddingRight, "34px", "open Other title keeps the shared close reserve");
    f.click('[data-bb-chat-ui-info-trigger="workflow"]');
    const workflow = stack.querySelector('section[aria-label="Workflow"]')!;
    const flatFace = (value: string) => value === "rgba(0, 0, 0, 0)" || value === "transparent" || value === "color-mix(in oklab, var(--foreground) 6%, transparent)";
    const phaseBlur = (node: Element) => `${paint(node).backdropFilter} ${paint(node).getPropertyValue("-webkit-backdrop-filter")}`;
    for (const phase of ["done", "active"]) {
      const button = workflow.querySelector<HTMLButtonElement>(`[data-phase="${phase}"]`)!;
      assert.equal(button.hasAttribute("aria-controls"), false, `${phase} phase has no aria-controls`);
      assert.equal(flatFace(paint(button).backgroundColor), true, `${phase} phase is flat`);
      assert.equal(paint(button).boxShadow, "none", `${phase} phase has no shadow`);
      assert.equal(phaseBlur(button).includes("blur"), false, `${phase} phase has no nested blur`);
    }
    const done = workflow.querySelector<HTMLButtonElement>('[data-phase="done"]')!;
    done.click();
    assert.equal(phaseClicks, 1, "a phase disclosure still runs its callback");
    assert.equal(done.getAttribute("aria-expanded"), "true");
    assert.equal(flatFace(paint(done).backgroundColor), true, "a clicked phase stays flat");
    assert.equal(paint(done).boxShadow, "none");
    const workflowRetry = workflow.querySelector<HTMLButtonElement>("[data-workflow-action]")!;
    assert.equal(phaseBlur(workflowRetry).includes("blur("), false, "a workflow action adds no second glass");
  } finally { stop(); }
  assert.equal(f.document.querySelector("[data-bb-chat-ui-info-plan-exit-label]"), null);
  assert.equal(f.document.querySelector("[data-bb-chat-ui-info-fallback-dismiss-label]"), null);
  f.dom.window.close();
});

test("desktop hover previews wait for intent, bridge the popover gap, and pin on click", async () => {
  const f=fixture();
  f.document.body.insertAdjacentHTML('beforeend','<span hidden data-bb-chat-ui-device="desktop" data-bb-chat-ui-viewport="narrow"></span>');
  const wait=(ms:number)=>new Promise(resolve=>f.dom.window.setTimeout(resolve,ms));
  const stop=injectComposerInfo(f.document);
  const goal=f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]')!;
  const queue=f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]')!;
  const orb=f.document.querySelector('[data-bb-chat-ui-info-all]')!;
  try {
    pointer(f,'pointerover',goal);
    assert.equal(goal.getAttribute('aria-expanded'),'false','hover does not open immediately');
    pointer(f,'pointerout',goal,f.document.body); await wait(210);
    assert.equal(goal.getAttribute('aria-expanded'),'false','passing over a pill is ignored');
    pointer(f,'pointerover',goal); await wait(210);
    assert.equal(goal.getAttribute('aria-expanded'),'true');
    const panel=f.document.querySelector('[data-bb-chat-ui-info-open]')!;
    pointer(f,'pointerout',goal,f.document.body);
    pointer(f,'pointerover',panel,f.document.body); await wait(170);
    assert.equal(goal.getAttribute('aria-expanded'),'true','the gap does not close a preview before entering its card');
    pointer(f,'pointerout',panel,f.document.body); await wait(170);
    assert.equal(goal.getAttribute('aria-expanded'),'false');
    pointer(f,'pointerover',goal); await wait(210);
    f.click('[data-bb-chat-ui-info-trigger="goal"]');
    pointer(f,'pointerout',goal,f.document.body); await wait(170);
    assert.equal(goal.getAttribute('aria-expanded'),'true','click pins the preview instead of toggling it shut');
    pointer(f,'pointerover',queue); await wait(210);
    assert.equal(goal.getAttribute('aria-expanded'),'true','hover cannot replace a clicked popover');
    assert.equal(queue.getAttribute('aria-expanded'),'false');
    f.click('[data-bb-chat-ui-info-trigger="goal"]');
    assert.equal(goal.getAttribute('aria-expanded'),'false','a second click keeps the normal toggle');
    pointer(f,'pointerover',orb); await wait(210);
    assert.ok(f.document.querySelector('[data-bb-chat-ui-info-menu]'));
    f.click('[data-bb-chat-ui-info-choice="queue"]');
    pointer(f,'pointerout',f.document.querySelector('[data-bb-chat-ui-info-open]')!,f.document.body); await wait(170);
    assert.equal(queue.getAttribute('aria-expanded'),'true','catalog selection opens a persistent detail');
    f.click('[data-bb-chat-ui-info-trigger="queue"]');
    pointer(f,'pointerover',goal); await wait(210);
    const focusTarget=f.document.querySelector<HTMLElement>('[aria-label="Clear active Goal"]')!;
    focusTarget.focus();
    pointer(f,'pointerout',focusTarget,f.document.body); await wait(170);
    assert.equal(goal.getAttribute('aria-expanded'),'true','keyboard focus within the preview keeps its actions available');
  } finally { stop(); f.dom.window.close(); }
});

// Model the native disclosure's collapse-button focus without treating it as a user pin.
test("queue hover previews dismiss after native collapse focus while user actions still pin", async t => {
  for (const timing of ["synchronous", "effect"]) await t.test(timing, async () => {
    const f = fixture();
    f.document.body.insertAdjacentHTML('beforeend', '<span hidden data-bb-chat-ui-device="desktop"></span>');
    const card = f.document.querySelector<HTMLElement>('section[aria-label="Queued messages"]')!;
    const native = card.querySelector<HTMLButtonElement>('header button')!;
    const collapse = f.document.createElement('button');
    collapse.setAttribute('aria-label', 'Collapse queued messages');
    card.append(collapse);
    // Reproduce both immediate focus and the host's deferred disclosure effect.
    native.addEventListener('click', () => {
      if (native.getAttribute('aria-expanded') !== 'true') return;
      if (timing === 'effect') f.dom.window.setTimeout(() => collapse.focus(), 0);
      else collapse.focus();
    });
    // Let native effects and the existing hover intent timers settle.
    const wait = (ms: number) => new Promise(resolve => f.dom.window.setTimeout(resolve, ms));
    const stop = injectComposerInfo(f.document);
    const pill = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="queue"]')!;
    try {
      pointer(f, 'pointerover', pill); await wait(230);
      assert.equal(pill.getAttribute('aria-expanded'), 'true');
      assert.equal(f.document.activeElement, collapse, 'native opening moves focus to its collapse control');
      pointer(f, 'pointerout', pill, f.document.body); await wait(190);
      assert.equal(pill.getAttribute('aria-expanded'), 'false', 'native focus must not pin a mouse-only preview');
      assert.equal(card.hasAttribute('data-bb-chat-ui-info-open'), false);

      pointer(f, 'pointerover', pill); await wait(230);
      pointer(f, 'pointerout', pill, card);
      pointer(f, 'pointerover', card, pill);
      card.querySelector<HTMLButtonElement>('#queue button')!.focus();
      pointer(f, 'pointerout', card, f.document.body); await wait(190);
      assert.equal(pill.getAttribute('aria-expanded'), 'true', 'focus on a real queue action still pins its preview');
      pill.click();

      pointer(f, 'pointerover', pill); await wait(230);
      pill.click();
      pointer(f, 'pointerout', pill, f.document.body); await wait(190);
      assert.equal(pill.getAttribute('aria-expanded'), 'true', 'clicking the pill still pins its preview');
    } finally { stop(); f.dom.window.close(); }
  });
});

test("hover previews exclude phone, tablet, and touch input while clicks keep working", async () => {
  for (const [device,pointerType] of [['phone','mouse'],['tablet','mouse'],['desktop','touch']]) {
    const f=fixture();
    f.document.body.insertAdjacentHTML('beforeend',`<span hidden data-bb-chat-ui-device="${device}" data-bb-chat-ui-viewport="wide"></span>`);
    const stop=injectComposerInfo(f.document);
    try {
      const goal=f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]')!;
      pointer(f,'pointerover',goal,null,pointerType);
      await new Promise(resolve=>f.dom.window.setTimeout(resolve,210));
      assert.equal(goal.getAttribute('aria-expanded'),'false');
      f.click('[data-bb-chat-ui-info-trigger="goal"]');
      assert.equal(goal.getAttribute('aria-expanded'),'true');
    } finally { stop(); f.dom.window.close(); }
  }
});

test("hover timers are cancelled on thread changes, input requests, and unload", async () => {
  const f=fixture();
  f.document.body.insertAdjacentHTML('beforeend','<span hidden data-bb-chat-ui-device="desktop"></span>');
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const stop=injectComposerInfo(f.document);
  const goal=f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]')!;
  try {
    pointer(f,'pointerover',goal);
    source.setAttribute('data-bb-chat-ui-info-thread','another'); await f.tick();
    await new Promise(resolve=>f.dom.window.setTimeout(resolve,210));
    assert.equal(goal.getAttribute('aria-expanded'),'false','a pending hover cannot open in another thread');
    pointer(f,'pointerover',goal);
    stack.insertAdjacentHTML('beforeend','<div data-testid="user-question-banner">Question</div>'); await f.tick();
    await new Promise(resolve=>f.dom.window.setTimeout(resolve,210));
    assert.equal(goal.getAttribute('aria-expanded'),'false','input requests take priority');
    stack.querySelector('[data-testid="user-question-banner"]')!.remove(); await f.tick();
    pointer(f,'pointerover',goal); stop();
    await new Promise(resolve=>f.dom.window.setTimeout(resolve,210));
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-open]'),null);
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-menu]'),null);
  } finally { stop(); f.dom.window.close(); }
});

test("default settings expose all available information while empty families stay catalog-only", () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  try {
    assert.deepEqual([...f.document.querySelectorAll('[data-bb-chat-ui-info-trigger]')].map(node => node.getAttribute('data-bb-chat-ui-info-trigger')), ['diff','children','goal','todos','queue','pullRequest','other']);
    f.click('[data-bb-chat-ui-info-all]');
    assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice]').length,infoKinds.length);
    assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="plan"][data-bb-chat-ui-info-unavailable]'));
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="plan"]'),null);
  } finally { stop(); f.dom.window.close(); }
});

test("native popovers replace only their bottom collapse with a small close without ending Plan or Goal", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const cards: { kind:string; node:HTMLElement; toggle:HTMLButtonElement; collapse:HTMLButtonElement }[] = [];
  let ended = 0;
  for (const [kind, label] of [['plan','Prompt mode'], ['goal','Goal'], ['todos','To-do list'], ['workflow','Workflow'], ['background','Background commands'], ['machine','Machine status'], ['status','Thread history']]) {
    stack.querySelector(`section[aria-label="${label}"]`)?.remove();
    const node = f.document.createElement('section'); node.setAttribute('aria-label',label);
    node.innerHTML = `<div role="group"><button ${kind === 'machine' ? 'id="machine-status-toggle"' : ''} aria-expanded="false" aria-controls="${kind}-body">${label}</button><button aria-label="${kind === 'plan' ? 'Exit plan mode' : 'Clear active Goal'}">End</button></div><div id="${kind}-body" hidden><h3>Body heading</h3><p>Details</p><button aria-label="Collapse internal list" aria-expanded="true" aria-controls="internal-${kind}">Internal fold</button><div id="internal-${kind}">Items</div><div class="px-1 pb-1"><button aria-label="Collapse ${label}" aria-expanded="true" aria-controls="${kind}-body">Collapse</button></div></div>`;
    const toggle = node.querySelector<HTMLButtonElement>('button')!;
    const collapse = node.querySelector<HTMLButtonElement>(`button[aria-label="Collapse ${label}"]`)!;
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded',String(expanded));
      node.querySelector<HTMLElement>(`#${kind}-body`)!.hidden = !expanded;
    });
    collapse.addEventListener('click', () => toggle.click());
    node.querySelector('button[aria-label="Exit plan mode"], button[aria-label="Clear active Goal"]')!.addEventListener('click', () => ended++);
    stack.append(node); cards.push({kind,node,toggle,collapse});
  }
  const stop = injectComposerInfo(f.document);
  try {
    for (const {kind,node,toggle,collapse} of cards) {
      f.click('[data-bb-chat-ui-info-all]');
      f.click(`[data-bb-chat-ui-info-choice="${kind}"]`);
      await f.tick();
      assert.equal(resolvedStyle(collapse.parentElement!).display,'none',`${kind}: the standalone bottom handle takes no space`);
      assert.notEqual(resolvedStyle(node.querySelector('[aria-label="Collapse internal list"]')!).display,'none','internal list folds remain available');
      const dismiss = node.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-native-dismiss]');
      assert.ok(dismiss,`${kind}: a dedicated visual close is present`);
      assert.ok(dismiss.querySelector('svg[data-bb-chat-ui-card-close-icon]'),'native dismiss uses the shared geometric close');
      assert.equal(dismiss.textContent,'');
      assert.match(dismiss.getAttribute('aria-label')!,/ 닫기$/);
      assert.equal(dismiss.title,dismiss.getAttribute('aria-label'));
      const title=node.querySelector('[data-bb-chat-ui-info-close-heading]');
      if (kind==='goal') {
        assert.ok(title?.matches('h3'));
        assert.equal(title?.parentElement,node,'Goal uses its own standard popup title');
        assert.equal(title?.textContent,'Goal');
      } else assert.equal(title,toggle.parentElement,'reserve close space beside the actual title, not a heading in the body');
      assert.equal(node.querySelectorAll('[data-bb-chat-ui-info-native-dismiss]').length,1);
      dismiss.click();
      assert.equal(toggle.getAttribute('aria-expanded'),'false');
      assert.equal(node.hasAttribute('data-bb-chat-ui-info-open'),false);
      assert.equal(ended,0,'closing the popover never ends Plan or clears Goal');
    }
    stop();
    for (const {node,collapse} of cards) {
      assert.equal(node.querySelector('[data-bb-chat-ui-info-native-dismiss]'),null);
      assert.equal(collapse.hasAttribute('data-bb-chat-ui-info-collapse'),false);
      assert.notEqual(resolvedStyle(collapse.parentElement!).display,'none','unload restores native controls');
    }
  } finally { stop(); f.dom.window.close(); }
});

test("native close survives header replacement and keeps genuine actions on their original parents", async () => {
  const f = fixture();
  const node = f.document.querySelector<HTMLElement>('section[aria-label="Goal"]')!;
  const originalAction = node.querySelector('[aria-label="Clear active Goal"]')!;
  const originalParent = originalAction.parentElement;
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-all]'); f.click('[data-bb-chat-ui-info-choice="goal"]'); await f.tick();
    node.querySelector('[data-bb-chat-ui-info-native-dismiss]')!.remove();
    node.querySelector('button[aria-expanded]')!.textContent = 'Updated Goal';
    await f.tick();
    assert.equal(node.querySelectorAll('[data-bb-chat-ui-info-native-dismiss]').length,1);
    assert.equal(originalAction.parentElement,originalParent);
    f.click('[data-bb-chat-ui-info-native-dismiss]');
    assert.equal(node.hasAttribute('data-bb-chat-ui-info-open'),false);
  } finally { stop(); f.dom.window.close(); }
});

test("Parent uses the shared single-row card without a family heading", async () => {
  const f = fixture();
  const source = f.document.querySelector<HTMLElement>("[data-bb-chat-ui-info-settings]")!;
  source.insertAdjacentHTML("beforeend", '<span data-bb-chat-ui-info-icon="parent"><svg data-family="parent"></svg></span><span data-bb-chat-ui-info-child-icon="child-1"><svg data-provider="child-provider"></svg></span>');
  const card = f.document.querySelector<HTMLElement>('section[aria-label="Thread context before sending"]')!;
  const sectionParent = card.parentElement;
  const shared = `<div class="flex items-center gap-0.5 p-1"><button type="button" id="thread-prompt-banner-parent-thread-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-parent-thread-body" aria-label="Parent thread"><svg data-icon="UserRound"></svg></button><a href="https://example.com/pr/12" aria-label="Pull request 12: Open">#12</a><button type="button" id="thread-prompt-banner-git-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-git-body">+12 −4 · 3 files</button></div><section id="thread-prompt-banner-parent-thread-body" hidden><div class="bg-popover">This thread is a child of <a href="/threads/parent-1"><span>네이티브 제목</span></a>.</div><div><button type="button" aria-expanded="true" aria-controls="thread-prompt-banner-parent-thread-body" aria-label="Collapse parent thread">Collapse</button></div></section><section id="thread-prompt-banner-git-body" hidden><div>lib/composer-info.ts</div></section>`;
  const alone = `<div class="native-inlay"><svg data-icon="UserRound"></svg><span>Parent <a href="/threads/parent-only">Parent only title</a></span></div>`;
  const wire = () => {
    for (const toggle of card.querySelectorAll<HTMLButtonElement>('button[id$="-toggle"]')) {
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(expanded));
        const body = card.querySelector<HTMLElement>(`#${toggle.getAttribute("aria-controls")}`);
        if (body) body.hidden = !expanded;
      });
    }
  };
  const publish = (id: string, title: string, provider: string, navigate: boolean) => {
    source.querySelector("[data-bb-chat-ui-info-parent-icon]")?.remove();
    source.querySelector("[data-bb-chat-ui-info-parent-open]")?.remove();
    source.setAttribute("data-bb-chat-ui-info-parent", JSON.stringify({ id, title, providerId: provider }));
    source.insertAdjacentHTML("beforeend", `<span data-bb-chat-ui-info-parent-icon="${id}"><svg data-provider="${provider}"></svg></span>${navigate ? `<button type="button" data-bb-chat-ui-info-parent-open="${id}"></button>` : ""}`);
  };
  card.innerHTML = shared;
  wire();
  const nativeLink = () => card.querySelector<HTMLAnchorElement>('a[href*="/threads/"]')!;
  const linkParent = nativeLink().parentElement;
  let sdkMoves = 0;
  let linkMoves = 0;
  const countLink = () => { nativeLink().addEventListener("click", event => { event.preventDefault(); linkMoves += 1; }); };
  countLink();
  publish("parent-1", "아주 긴 부모 스레드 제목은 닫기 앞에서 끊긴다", "codex", true);
  source.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-open]")!.addEventListener("click", () => { sdkMoves += 1; });
  const stop = injectComposerInfo(f.document);
  const nativeCard = () => card.innerHTML.replaceAll('hidden=""', "hidden");
  const resting = nativeCard();
  const style = (node: Element) => resolvedStyle(node);
  const shown = (selector: string) => style(card.querySelector(selector)!).display !== "none";
  try {
    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    const head = card.querySelector<HTMLElement>("[data-bb-chat-ui-card-head]")!;
    assert.equal(head, null, "the parent navigation is the only content line");
    const closeIcon = card.querySelector('[data-bb-chat-ui-card-close] > svg[data-bb-chat-ui-card-close-icon]');
    assert.ok(closeIcon);assert.equal(style(closeIcon).display,'block','Parent hides obsolete native artwork while keeping the geometric close visible');
    assert.equal(card.getAttribute('data-bb-chat-ui-card-layout'), 'single-row', "the adapter binds Parent to the common navigation variant");
    assert.equal(card.querySelector('[data-bb-chat-ui-info-title-icon="parent"]'), null);
    const row = card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-row]")!;
    assert.ok(row, "the parent is one card row");
    assert.equal(card.querySelectorAll("[data-bb-chat-ui-info-parent-row]").length, 1);
    assert.equal(row.parentElement, card);
    assert.equal(row.tagName, "BUTTON");
    assert.equal(row.getAttribute("href"), null);
    assert.equal(row.querySelector("[data-provider]")?.getAttribute("data-provider"), "codex");
    assert.equal(row.querySelector('[data-provider="child-provider"]'), null);
    assert.equal(row.querySelector("[data-family]"), null);
    assert.equal(row.querySelector("[data-icon='UserRound']"), null);
    assert.equal(row.textContent, "아주 긴 부모 스레드 제목은 닫기 앞에서 끊긴다");
    assert.equal(row.querySelector("[data-bb-chat-ui-info-child-meta], [data-bb-chat-ui-info-child-status], [data-bb-chat-ui-info-avatar-dot]"), null);
    const title = row.querySelector<HTMLElement>("[data-bb-chat-ui-info-parent-title]")!;
    assert.equal(style(title).textOverflow, "ellipsis");
    assert.equal(style(title).whiteSpace, "nowrap");
    assert.equal(style(row).cursor, "pointer");
    assert.equal(style(row).borderRadius, "18px");
    assert.equal(style(row).padding, "8px 32px 8px 12px", "the whole face is clickable while text reserves the close");
    assert.equal(style(row).minHeight, "36px");
    assert.equal(style(row).width, "100%");
    assert.ok(row.hasAttribute('data-bb-chat-ui-card-navigation'));
    assert.equal(style(card).padding, "0px", "a compact card has no dead outer gutter");
    assert.match(style(card).backdropFilter, /blur\(14px\)/);
    assert.match(style(card).animation, /bb-info-enter/);
    const dismiss = card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-native-dismiss]")!;
    assert.equal(card.querySelectorAll("[data-bb-chat-ui-info-native-dismiss]").length, 1);
    assert.equal(dismiss.closest("[data-bb-chat-ui-info-parent-row]"), null);
    assert.equal(style(dismiss).width, "20px");
    assert.equal(style(dismiss).height, "20px");
    assert.equal(style(dismiss).top, "8px", "the close centers on the 40px card");
    assert.equal(style(dismiss).right, "6px");
    assert.equal(shown("#thread-prompt-banner-parent-thread-body"), false, "the relationship sentence stays out of the popover");
    assert.equal(shown("#thread-prompt-banner-git-toggle"), false);
    assert.equal(shown("#thread-prompt-banner-git-body"), false);
    assert.equal(shown('[aria-label^="Pull request "]'), false);
    assert.equal(shown("#thread-prompt-banner-parent-thread-toggle"), false);
    assert.equal(style(card.querySelector("svg[data-icon='UserRound']")!).display, "none");
    assert.equal(nativeLink().parentElement, linkParent);
    assert.equal(card.parentElement, sectionParent);
    row.click();
    assert.equal(sdkMoves, 1, "the row uses the parent navigate control");
    assert.equal(linkMoves, 0, "the row does not move or activate the native link when navigate is available");
    assert.equal(nativeLink().parentElement, linkParent);
    assert.equal(card.hasAttribute("data-bb-chat-ui-info-open"), true);
    dismiss.click();
    assert.equal(sdkMoves, 1);
    assert.equal(linkMoves, 0);
    assert.equal(card.hasAttribute("data-bb-chat-ui-info-open"), false);
    assert.equal(card.querySelector("[data-bb-chat-ui-info-parent-row]"), null);
    assert.equal(nativeCard(), resting);

    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    f.document.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    assert.equal(card.hasAttribute("data-bb-chat-ui-info-open"), false);
    assert.equal(nativeCard(), resting);
    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    f.document.body.dispatchEvent(new f.dom.window.PointerEvent("pointerdown", { bubbles: true }));
    assert.equal(card.hasAttribute("data-bb-chat-ui-info-open"), false);
    assert.equal(nativeCard(), resting);

    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    publish("parent-2", "다른 부모", "claude", true);
    source.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-parent-open="parent-2"]')!.addEventListener("click", () => { sdkMoves += 1; });
    await f.tick();
    const replaced = card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-row]")!;
    assert.equal(replaced.textContent, "다른 부모");
    assert.equal(replaced.querySelector("[data-provider]")?.getAttribute("data-provider"), "claude");
    assert.equal(replaced.textContent?.includes("아주 긴 부모"), false);
    source.removeAttribute("data-bb-chat-ui-info-parent");
    source.querySelector("[data-bb-chat-ui-info-parent-icon]")?.remove();
    source.querySelector("[data-bb-chat-ui-info-parent-open]")?.remove();
    await f.tick();
    assert.equal(card.querySelector("[data-bb-chat-ui-info-parent-row]"), null, "a removed parent does not leave the previous row");
    assert.equal(shown("#thread-prompt-banner-parent-thread-body"), true, "a removed parent shows the native card instead of an empty popover");
    replaced.click();
    assert.equal(sdkMoves, 1, "a removed parent row does not navigate to the previous parent");

    card.innerHTML = shared;
    wire();
    countLink();
    await f.tick();
    assert.equal(card.querySelector<HTMLButtonElement>("#thread-prompt-banner-parent-thread-toggle")!.getAttribute("aria-expanded"), "true");
    assert.equal(card.querySelector("[data-bb-chat-ui-info-parent-row]"), null, "a rerender does not keep a parent that is already gone");
    publish("parent-1", "늦은 부모", "codex", true);
    await f.tick();
    const late = card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-row]")!;
    assert.equal(late.textContent, "늦은 부모");
    assert.equal(late.querySelector("[data-provider]")?.getAttribute("data-provider"), "codex");
    assert.equal(nativeLink().parentElement?.closest("[data-bb-chat-ui-info-parent-row]"), null);
    card.querySelector("#thread-prompt-banner-git-toggle")!.textContent = "+200 −1 · 2 files";
    await f.tick();
    assert.equal(shown("#thread-prompt-banner-git-toggle"), false);
    assert.equal(shown("#thread-prompt-banner-git-body"), false);
    assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.textContent?.includes("+200"));
    f.click('[data-bb-chat-ui-info-trigger="pullRequest"]'); await f.tick();
    assert.equal(card.getAttribute("data-bb-chat-ui-info-open"), "pullRequest");
    assert.equal(card.querySelector("[data-bb-chat-ui-info-parent-row]"), null, "PR does not keep the parent row");
    assert.equal(shown('[aria-label^="Pull request "]'), true);
    assert.equal(shown("#thread-prompt-banner-parent-thread-body"), false);

    card.innerHTML = alone;
    const inlineLink = card.querySelector<HTMLAnchorElement>('a[href="/threads/parent-only"]')!;
    const inlineParent = inlineLink.parentElement;
    inlineLink.addEventListener("click", event => { event.preventDefault(); linkMoves += 1; });
    publish("parent-only", "Parent only title", "codex", false);
    await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    const only = card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-row]")!;
    assert.equal(only.textContent, "Parent only title");
    assert.equal(only.querySelector("[data-provider]")?.getAttribute("data-provider"), "codex");
    assert.equal(style(card.querySelector("svg[data-icon='UserRound']")!).display, "none");
    assert.equal(style(inlineLink).display, "none");
    assert.equal(card.querySelector("[data-bb-chat-ui-card-head]"), null);
    assert.equal(inlineLink.parentElement, inlineParent);
    const before = linkMoves;
    only.click();
    assert.equal(linkMoves, before + 1, "without the navigate control the row uses the native parent link");
    assert.equal(inlineLink.parentElement, inlineParent);
    f.click("[data-bb-chat-ui-info-native-dismiss]");
    assert.equal(card.innerHTML, alone);
    source.setAttribute("data-bb-chat-ui-info-thread", "another-thread");
    await f.tick();
    assert.equal(card.hasAttribute("data-bb-chat-ui-info-open"), false);
    assert.equal(card.querySelector("[data-bb-chat-ui-info-parent-row]"), null);
    stop();
    assert.equal(card.innerHTML, alone);
    assert.equal(card.parentElement, sectionParent);
  } finally { stop(); f.dom.window.close(); }
});

test("Parent popover keeps one row before parent metadata and does not follow a removed parent", async () => {
  const f = fixture();
  const source = f.document.querySelector<HTMLElement>("[data-bb-chat-ui-info-settings]")!;
  source.insertAdjacentHTML("beforeend", '<span data-bb-chat-ui-info-icon="parent"><svg data-family="parent"></svg></span><span data-bb-chat-ui-info-child-icon="child-1"><svg data-provider="child-provider"></svg></span><button type="button" data-bb-chat-ui-info-parent-open="other-thread"></button>');
  const card = f.document.querySelector<HTMLElement>('section[aria-label="Thread context before sending"]')!;
  card.innerHTML = '<div class="flex items-center gap-0.5 p-1"><button type="button" id="thread-prompt-banner-parent-thread-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-parent-thread-body" aria-label="Parent thread"><svg data-icon="UserRound"></svg></button><a href="https://example.com/pr/12" aria-label="Pull request 12: Open">#12</a><button type="button" id="thread-prompt-banner-git-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-git-body">+12 −4 · 3 files</button></div><section id="thread-prompt-banner-parent-thread-body" hidden>This thread is a child of <a href="/threads/parent-1"><span>네이티브 제목</span></a>.</section><section id="thread-prompt-banner-git-body" hidden>lib/composer-info.ts</section>';
  for (const toggle of card.querySelectorAll<HTMLButtonElement>('button[id$="-toggle"]')) {
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") !== "true";
      toggle.setAttribute("aria-expanded", String(expanded));
      const body = card.querySelector<HTMLElement>(`#${toggle.getAttribute("aria-controls")}`);
      if (body) body.hidden = !expanded;
    });
  }
  const nativeLink = () => card.querySelector<HTMLAnchorElement>('a[href="/threads/parent-1"]')!;
  let nativeMoves = 0;
  let staleMoves = 0;
  let oldMoves = 0;
  let nextMoves = 0;
  nativeLink().addEventListener("click", event => { event.preventDefault(); nativeMoves += 1; });
  source.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-parent-open="other-thread"]')!.addEventListener("click", () => { staleMoves += 1; });
  const stop = injectComposerInfo(f.document);
  const shown = (selector: string) => resolvedStyle(card.querySelector(selector)!).display !== "none";
  const row = () => card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-row]");
  try {
    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    const waiting = row()!;
    assert.ok(waiting, "parent metadata that is not ready still leaves one row");
    assert.equal(waiting.textContent, "네이티브 제목");
    assert.equal(waiting.querySelector("[data-provider], [data-family], [data-icon='UserRound']"), null, "the temporary row does not borrow another thread icon");
    assert.equal(shown("#thread-prompt-banner-parent-thread-body"), false);
    assert.equal(shown("#thread-prompt-banner-git-toggle"), false);
    assert.equal(shown('[aria-label^="Pull request "]'), false);
    assert.equal(resolvedStyle(waiting).display !== "none", true);
    waiting.click();
    assert.equal(nativeMoves, 1, "the temporary row uses this card's native parent link");
    assert.equal(staleMoves, 0);

    source.setAttribute("data-bb-chat-ui-info-parent", "null");
    await f.tick();
    const failed = row()!;
    assert.ok(failed, "a failed parent lookup does not leave only the close button");
    assert.equal(failed.textContent, "네이티브 제목");
    assert.equal(failed.querySelector("[data-provider], [data-family]"), null);
    failed.click();
    assert.equal(nativeMoves, 2);
    assert.equal(staleMoves, 0);

    source.setAttribute("data-bb-chat-ui-info-parent", JSON.stringify({ id: "parent-1", title: "이전 부모", providerId: "codex" }));
    source.insertAdjacentHTML("beforeend", '<span data-bb-chat-ui-info-parent-icon="parent-1"><svg data-provider="codex"></svg></span><button type="button" data-bb-chat-ui-info-parent-open="parent-1"></button>');
    source.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-parent-open="parent-1"]')!.addEventListener("click", () => { oldMoves += 1; });
    await f.tick();
    assert.equal(row()!.textContent, "이전 부모");
    assert.equal(row()!.querySelector("[data-provider]")?.getAttribute("data-provider"), "codex");
    source.setAttribute("data-bb-chat-ui-info-parent", JSON.stringify({ id: "parent-2", title: "다음 부모", providerId: "claude" }));
    source.insertAdjacentHTML("beforeend", '<span data-bb-chat-ui-info-parent-icon="parent-2"><svg data-provider="claude"></svg></span><button type="button" data-bb-chat-ui-info-parent-open="parent-2"></button>');
    source.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-parent-open="parent-2"]')!.addEventListener("click", () => { nextMoves += 1; });
    await f.tick();
    const replaced = row()!;
    assert.equal(replaced.textContent, "다음 부모");
    assert.equal(replaced.querySelector("[data-provider]")?.getAttribute("data-provider"), "claude");
    replaced.click();
    assert.equal(nextMoves, 1, "replacement follows the new parent");
    assert.equal(oldMoves, 0, "replacement does not follow the previous parent");
    assert.equal(nativeMoves, 2);
    assert.equal(staleMoves, 0);

    source.removeAttribute("data-bb-chat-ui-info-parent");
    await f.tick();
    assert.equal(row(), null, "a removed parent does not keep the previous row");
    assert.equal(shown("#thread-prompt-banner-parent-thread-body"), true, "a removed parent does not leave only the close button");
    replaced.click();
    assert.equal(oldMoves, 0);
    assert.equal(nextMoves, 1);
    assert.equal(nativeMoves, 2, "a removed parent row does not navigate to the previous parent");
    assert.equal(staleMoves, 0);
  } finally { stop(); f.dom.window.close(); }
});

test("Parent native-link fallback also uses a single row without a heading", async () => {
  for (const inline of [true, false]) {
    const f = fixture();
    const node = f.document.querySelector<HTMLElement>('section[aria-label="Thread context before sending"]')!;
    node.innerHTML = inline
      ? '<div class="native-inlay"><div><svg /><span>Parent <a href="/threads/parent">Parent title</a></span></div></div>'
      : '<div class="native-inlay"><button id="thread-prompt-banner-parent-thread-toggle" aria-label="Parent thread: Parent title" aria-expanded="false" aria-controls="parent-detail"><svg /></button></div><div id="parent-detail" hidden>This thread is a child of <a href="/threads/parent">Parent title</a>.</div>';
    const original = node.innerHTML;
    const link = node.querySelector('a')!;
    const linkParent = link.parentElement;
    const toggle = node.querySelector<HTMLButtonElement>('button');
    toggle?.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      node.querySelector<HTMLElement>('#parent-detail')!.hidden = !expanded;
    });
    const stop = injectComposerInfo(f.document);
    try {
      f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
      const waiting = node.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-parent-row]');
      assert.equal(node.querySelector('[data-bb-chat-ui-card-head]'), null, 'native-link fallback does not add a family heading');
      assert.equal(node.getAttribute('data-bb-chat-ui-card-layout'), 'single-row');
      assert.equal(waiting?.textContent, 'Parent title', 'this card native title fills the row before parent metadata');
      assert.equal(waiting?.querySelector('[data-provider], [data-family]'), null);
      assert.equal(resolvedStyle(link).display, 'none', 'the native sentence and link stay out of the popover');
      assert.equal(link.parentElement, linkParent, 'native parent navigation keeps its original structure');
      assert.equal(link.getAttribute('href'), '/threads/parent');
      if (toggle) assert.equal(toggle.getAttribute('aria-expanded'), 'true');
      f.click('[data-bb-chat-ui-info-native-dismiss]');
      assert.equal(node.querySelector('[data-bb-chat-ui-info-close-heading]'), null);
      assert.equal(node.querySelector('[data-bb-chat-ui-info-parent-row]'), null);
      if (toggle) assert.equal(toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(node.innerHTML, original, 'closing restores the native card');
    } finally { stop(); f.dom.window.close(); }
  }
});

test("the Workflow stack collapse is hidden without becoming another information entry", () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const wrapper = f.document.createElement('div');
  wrapper.innerHTML = '<div id="workflow-stack"><section aria-label="Workflow"><button aria-expanded="false" aria-controls="workflow-detail">Workflow A</button><div id="workflow-detail" hidden>Phase A</div></section></div><button aria-label="Collapse 2 workflows" aria-expanded="true" aria-controls="workflow-stack">Collapse stack</button>';
  stack.append(wrapper);
  const collapse = wrapper.querySelector('[aria-label="Collapse 2 workflows"]')!;
  const stop = injectComposerInfo(f.document);
  try {
    assert.equal(resolvedStyle(collapse).display,'none');
    assert.equal(collapse.hasAttribute('data-bb-chat-ui-info-unit'),false,'a stack close is not plugin information');
    f.click('[data-bb-chat-ui-info-all]');
    assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice="workflow"]').length,1);
    assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice="other"]').length,1,'only the actual plugin notice stays in the catalog');
  } finally { stop(); }
  assert.notEqual(resolvedStyle(collapse).display,'none');
  f.dom.window.close();
});

test("overflow reserves the all-information button and prefers Diff and children", () => {
  const items = [
    { key: "goal", width: 70 }, { key: "children", width: 75 },
    { key: "diff", width: 140 }, { key: "todos", width: 60 },
  ];
  assert.deepEqual(fitComposerInfo(items, 270), ["diff", "children"]);
  assert.deepEqual(fitComposerInfo(items, 390), ["diff", "children", "goal"]);
  assert.deepEqual(fitComposerInfo(items, 120), ["children"]);
  assert.deepEqual(fitComposerInfo(items, 30), []);
});

test("pills use a sequential droplet entrance once, preserving avatar motion and cancelling on unload", async () => {
  const f = fixture();
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showInactiveInfo:true, showGoal:'상단 표시', showQueue:'상단 표시' }));
  source.setAttribute('data-bb-chat-ui-info-children', JSON.stringify([1,2,3].map(id => ({ id:String(id),title:`Child ${id}`,state:'run' }))));
  const entries: { key:string; frames:Keyframe[]; options:KeyframeAnimationOptions; cancelled:boolean }[] = [];
  f.dom.window.HTMLElement.prototype.animate = function(frames, options) {
    const key = this.getAttribute('data-bb-chat-ui-info-trigger');
    const entry = { key:key ?? 'orb', frames:frames as Keyframe[], options:options as KeyframeAnimationOptions, cancelled:false };
    entries.push(entry);
    return { cancel:() => { entry.cancelled = true; } } as Animation;
  };
  const stop = injectComposerInfo(f.document);
  const pills = () => entries.filter(entry => entry.key !== 'orb' && entry.options.duration === 460);
  const bar=f.document.querySelector('[data-bb-chat-ui-info-bar]')!;
  const all=bar.querySelector('[data-bb-chat-ui-info-all]')!;
  for (const pill of bar.querySelectorAll('[data-bb-chat-ui-info-trigger]')) assert.ok(pill.compareDocumentPosition(all) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING,'the all-information button closes the row on the right');
  assert.equal(resolvedStyle(f.document.querySelector('[data-bb-chat-ui-info-all]')!).position,'relative','the all-information button anchors its own count badge');
  const visible = ['diff', 'goal', 'todos', 'queue', 'pullRequest', 'other'];
  assert.deepEqual(pills().map(entry => entry.key), visible);
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-avatar][data-new]'), 'avatars retain their existing individual bubbles');
  assert.deepEqual(pills()[0].frames.map(frame => frame.transform), [
    'translateY(8px) scale(.82,.72)', 'translateY(-4px) scale(.94,1.16)',
    'translateY(0) scale(1.1,.94)', 'translateY(-1px) scale(.985,1.015)', 'none',
  ]);
  assert.deepEqual(pills()[0].frames.map(frame => frame.offset), [0,.35,.65,.82,1], 'stretch, landing squash and gentle recovery fit inside one quick entrance');
  assert.equal(pills()[0].options.duration, 460);
  assert.ok(pills()[0].frames.every(frame => frame.opacity === undefined),'ordinary pill entrance keeps the remote opacity behavior');
  assert.deepEqual(pills().map(entry => entry.options.delay), [0,180,225,270,315,360], 'visible pills and child avatars enter from the left in 45ms steps');
  assert.ok(pills().every(entry => entry.options.fill === 'backwards'), 'delayed pills hold their starting pose until their turn');
  assert.deepEqual([...f.document.querySelectorAll<HTMLElement>('[data-bb-chat-ui-info-avatar][data-new]')].map(avatar => avatar.style.animationDelay), ['45ms','90ms','135ms']);
  assert.equal(pills()[0].frames[0].easing, 'cubic-bezier(.36,0,.18,1)');
  assert.equal(pills()[0].frames[1].easing, 'cubic-bezier(.36,0,.18,1)', 'each segment slows to zero at the turn and the end');
  assert.match(composerInfoCss, /animation:bb-info-droplet 460ms cubic-bezier\(\.36,0,\.18,1\) backwards/);
  assert.match(composerInfoCss, /35% \{ transform:translateY\(-4px\) scale\(\.94,1\.16\); \} 65% \{ transform:translateY\(0\) scale\(1\.1,\.94\); \} 82% \{ transform:translateY\(-1px\) scale\(\.985,1\.015\); \} 100% \{ transform:none; \}/);
  const firstAvatar=f.document.querySelector('[data-bb-chat-ui-info-avatar][data-new]');
  f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent = '+14 −4 · 3 files';
  await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-avatar][data-new]'),firstAvatar,'unrelated Diff arrival keeps the in-progress avatar bubble alive');
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showInactiveInfo:true, showGoal:'끄기', showQueue:'상단 표시' }));
  await f.tick();
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showInactiveInfo:true, showGoal:'상단 표시', showQueue:'상단 표시' }));
  await f.tick();
  f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
  assert.deepEqual(pills().map(entry => entry.key), visible, 'refresh, re-enable and resize do not replay entry motion');
  assert.equal(entries.filter(entry => entry.key === 'orb' && entry.options.duration === 460).length,1,'the all-information button enters once after the pills');
  assert.equal(entries.find(entry => entry.key === 'orb' && entry.options.duration === 460)?.options.delay,405);
  stop();
  assert.ok(pills().every(entry => entry.cancelled), 'in-progress entry animations are cancelled on unload');
  f.dom.window.close();
});

test("a changed information pill hops once, while disclosure, entry and queue arrival stay quiet", async () => {
  for (const reduced of [false, true]) {
    const f=fixture();
    Object.defineProperty(f.dom.window,'matchMedia',{value:() => ({matches:reduced})});
    const records:{node:Element; frames:Keyframe[]; options:KeyframeAnimationOptions; animation:Animation; cancelled:boolean}[]=[];
    const animate = stubAnimations(f.dom.window);
    f.dom.window.HTMLElement.prototype.animate=function(frames,options) {
      const record=animate.call(this, frames, options);
      records.push(record); return record.animation;
    };
    const stop=injectComposerInfo(f.document);
    try {
      const glyph=() => f.document.querySelector<SVGSVGElement>('[data-bb-chat-ui-info-glyph]')!;
      const css=resolvedStyle(glyph());
      assert.equal(css.width,'16px'); assert.equal(css.height,'16px');
      assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-all] img, [data-bb-chat-ui-info-all] image').length,0,'no downloaded asset is bundled');
      assert.ok(!css.animation || css.animation==='none','the resting glyph has no continuous animation');
      const hops=() => records.filter(record=>record.options.duration===420);
      const glyphMotion=() => records.filter(record=>record.node.matches('[data-bb-chat-ui-info-glyph], svg'));
      assert.equal(glyphMotion().length,0,'the glyph itself does not animate');
      f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent='+13 −4 · 3 files';
      await f.tick();
      assert.equal(hops().length,0,'a pill still playing its entry droplet does not hop');
      for (const record of records) if (record.options.duration===460) record.animation.onfinish?.(new f.dom.window.Event('finish') as unknown as AnimationPlaybackEvent);
      f.click('[data-bb-chat-ui-info-all]');
      f.click('[data-bb-chat-ui-info-all]');
      assert.equal(hops().length,0,'opening and closing do not hop');
      f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent='+18 −4 · 3 files';
      await f.tick();
      const diff=f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!;
      assert.equal(hops().length,0,'Diff numbers roll without hopping the pill');
      assert.equal(!!diff.querySelector('[data-bb-chat-ui-info-diff-current]'),!reduced,'roulette is retained except with reduced motion');
      const annotations=f.document.createElement('div');
      annotations.className='agentation-staging-shell';
      annotations.innerHTML='<button aria-expanded="false"><span class="tabular-nums">1</span></button><ul><li>Feedback</li></ul>';
      f.document.querySelector('[data-promptbox-shell] > .grid')!.append(annotations);
      await f.tick();
      for (const record of records) if (record.options.duration===460) record.animation.onfinish?.(new f.dom.window.Event('finish') as unknown as AnimationPlaybackEvent);
      records.length=0;
      annotations.querySelector('ul')!.insertAdjacentHTML('beforeend','<li>More feedback</li>');
      await f.tick();
      if (reduced) assert.equal(hops().length,0,'reduced motion skips annotation hops');
      else {
        const annotationHops=hops().filter(record=>record.node.matches('[data-bb-chat-ui-info-trigger="annotations"]'));
        assert.equal(annotationHops.length,1,'new feedback still hops its information pill');
        assert.deepEqual(annotationHops[0].frames.map(frame=>frame.transform),[
          'translateY(0) scale(1,1)','translateY(-7px) scale(.95,1.06)','translateY(0) scale(1.08,.9)','translateY(-2px) scale(.98,1.02)','translateY(0) scale(1,1)',
        ]);
      }
      const count=hops().length;
      await f.tick(); f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
      assert.equal(hops().length,count,'idle and layout updates do not hop');
      const queue=f.document.querySelector('section[aria-label="Queued messages"]')!;
      queue.querySelector('header button')!.innerHTML='<span data-queued-messages-count>2</span>';
      await f.tick();
      const queueHops=() => hops().filter(record=>record.node.matches('[data-bb-chat-ui-info-trigger="queue"]')).length;
      const beforeAdd=queueHops();
      const settled=hops().length;
      const row=f.document.createElement('div'); row.setAttribute('data-queued-message-id','new-send');
      queue.querySelector('#queue')!.append(row);
      queue.querySelector('[data-queued-messages-count]')!.textContent='3';
      await f.tick();
      assert.equal(queueHops(),beforeAdd,'a queue addition does not hop the queue pill');
      assert.equal(hops().length,settled,'a queue addition does not hop anything else');
      stop();
      assert.ok(hops().every(record=>record.cancelled),'unload cancels a hop still in progress');
    } finally {stop();f.dom.window.close();}
  }
});

test("pill bubbles wait for visible space and requests, and respect reduced motion", async () => {
  for (const reduced of [false, true]) {
    const f = fixture();
    Object.defineProperty(f.dom.window, 'matchMedia', { value:() => ({ matches:reduced }) });
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings', '{"showGoal":"상단 표시"}');
    Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { get:() => 120 });
    f.dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ width:10 } as DOMRect);
    const animated:string[] = [], reveals:string[] = [];
    f.dom.window.HTMLElement.prototype.animate = function(_frames,options) {
      const key = this.getAttribute('data-bb-chat-ui-info-trigger');
      if (key && (options as KeyframeAnimationOptions).duration === 460) animated.push(key);
      if (key && (options as KeyframeAnimationOptions).duration === 240) reveals.push(key);
      return { cancel() {} } as Animation;
    };
    const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
    let width = 30;
    stack.getBoundingClientRect = () => ({ width } as DOMRect);
    const request = f.document.createElement('div'); request.setAttribute('data-testid','user-question-banner'); stack.append(request);
    const stop = injectComposerInfo(f.document);
    assert.deepEqual(animated, []);
    width = 260; f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
    assert.deepEqual(animated, [], 'hidden request state does not consume entry motion');
    request.remove(); await f.tick();
    assert.deepEqual(animated, reduced ? [] : ['diff']);
    assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-trigger="goal"]')!.hidden, true, 'bubble scale does not make overflow pills fit');
    width = 500; f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
    assert.deepEqual(animated, reduced ? [] : ['diff','goal'], 'a first visible pill retains the bounce even if it started in the stack');
    assert.deepEqual(reveals,[],'first appearances are not mistaken for returns');
    width = 260; f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
    width = 500; f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
    assert.deepEqual(animated, reduced ? [] : ['diff','goal']);
    assert.deepEqual(reveals,[],'the remote behavior adds no returning-pill fade');
    stop(); f.dom.window.close();
  }
});

test("catalog entries retain their family icon with or without current information", async () => {
  const f = fixture();
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  for (const kind of infoKinds) source.insertAdjacentHTML('beforeend', `<span data-bb-chat-ui-info-icon="${kind.key}"><svg data-family="${kind.key}"><path d="M1 1h1" /></svg></span>`);
  f.document.querySelector('#thread-prompt-banner-child-threads-toggle')!.insertAdjacentHTML('afterbegin', '<svg data-chevron />');
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-all]');
  for (const kind of infoKinds) {
    const choice = f.document.querySelector(`[data-bb-chat-ui-info-choice="${kind.key}"]`)!;
    const icon = choice.querySelector('svg');
    assert.ok(icon, `${kind.label} has an icon even when no information is available`);
    assert.equal(icon.getAttribute('data-family'), kind.key);
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
  }
  const goal = f.document.querySelector('section[aria-label="Goal"]')!;
  goal.remove();
  await f.tick();
  const emptyGoal = f.document.querySelector('[data-bb-chat-ui-info-choice="goal"]')!;
  assert.ok(emptyGoal.hasAttribute('data-bb-chat-ui-info-unavailable'));
  assert.ok(emptyGoal.querySelector('[data-family="goal"]'));
  stop(); f.dom.window.close();
});

test("queue pill and catalog use the message-delay family icon instead of the hidden native disclosure glyph", async () => {
  const f = fixture();
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-settings', '{"showQueue":"상단 표시"}');
  source.insertAdjacentHTML('beforeend', '<span data-bb-chat-ui-info-icon="queue"><span data-icon-root data-icon="bb-chat-ui-queue"><svg viewBox="0 0 24 24"><path d="M18 6L19 5" /></svg></span></span>');
  const toggle = f.document.querySelector('section[aria-label="Queued messages"] header button')!;
  toggle.insertAdjacentHTML('afterbegin', '<svg data-icon="ChevronDown" style="display:none"><path d="m6 9 6 6 6-6" /></svg>');
  const stop = injectComposerInfo(f.document);
  const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]')!;
  assert.ok(pill.querySelector('[data-icon="bb-chat-ui-queue"]'));
  assert.equal(pill.querySelector('[data-icon="ChevronDown"]'), null);
  assert.equal(resolvedStyle(pill.querySelector('[data-icon-root]')!).width, '16px');
  f.click('[data-bb-chat-ui-info-all]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="queue"] [data-icon="bb-chat-ui-queue"]'));
  f.click('[data-bb-chat-ui-info-trigger="queue"]'); await f.tick();
  assert.ok(f.document.querySelector('section[aria-label="Queued messages"][data-bb-chat-ui-info-open]'));
  assert.ok(pill.querySelector('[data-icon="bb-chat-ui-queue"]'), 'expansion keeps the queue family icon');
  stop(); f.dom.window.close();
});

test("distinct family icons replace native duplicates in pills and the catalog, even when icons arrive late", async () => {
  const f=fixture();
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML('beforeend','<section aria-label="Prompt mode"><button><svg data-native-icon="ListTodo" /></button>Plan</section><section aria-label="Thread history"><button><svg data-native-icon="MessageSquare" /></button>Status</section><section aria-label="Machine status"><button id="machine-status-toggle"><svg data-native-icon="Terminal" /></button>Machine</section>');
  f.document.querySelector('.plugin-banner button')!.insertAdjacentHTML('afterbegin','<svg data-native-icon="AlertTriangle" />');
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  const stop=injectComposerInfo(f.document);
  try {
    for (const key of ['plan','status','machine','other']) source.insertAdjacentHTML('beforeend',`<span data-bb-chat-ui-info-icon="${key}"><svg data-family="${key}" /></span>`);
    await f.tick();
    for (const key of ['plan','status','machine','other']) {
      const pill=f.document.querySelector(`[data-bb-chat-ui-info-trigger="${key}"]`)!;
      assert.ok(pill.querySelector(`[data-family="${key}"]`),`${key}: the family artwork overrides the native duplicate`);
      assert.equal(pill.querySelector('[data-native-icon]'),null);
    }
    f.click('[data-bb-chat-ui-info-all]');
    for (const key of ['plan','status','machine','other']) assert.ok(f.document.querySelector(`[data-bb-chat-ui-info-choice="${key}"] [data-family="${key}"]`));
  } finally { stop(); f.dom.window.close(); }
});

test("custom Status icon wrappers use the same centered size as builtin icons", async () => {
  const f = fixture();
  f.document.head.insertAdjacentHTML('beforeend', '<style>.size-6 { width:24px; height:24px; }</style>');
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({showInactiveInfo:true,...Object.fromEntries(infoKinds.map(k=>[k.setting,['machine','fallback','status','other'].includes(k.key)?'목록에만 표시':'끄기']))}));
  source.insertAdjacentHTML('beforeend', '<span data-bb-chat-ui-info-icon="status"><span class="inline-flex size-6 shrink-0" data-icon-root data-icon="bb-chat-ui-status"><svg class="size-full" viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg></span></span>');
  f.document.querySelector(".plugin-banner")!.remove();
  const stop = injectComposerInfo(f.document);
  try {
    for (const available of [false, true]) {
      if (available) {
        f.document.querySelector('[data-promptbox-shell] > .grid')!.insertAdjacentHTML('beforeend', '<section aria-label="Thread history">Status details</section>');
        await f.tick();
      }
      f.click('[data-bb-chat-ui-info-all]');
      for (const selector of ['[data-bb-chat-ui-info-stack-kind="status"]', '[data-bb-chat-ui-info-choice="status"]']) {
        const icon = f.document.querySelector(`${selector} > [data-icon-root]`)!;
        assert.ok(icon, selector);
        const style = resolvedStyle(icon);
        assert.equal(style.width, '16px');
        assert.equal(style.height, '16px');
        assert.equal(style.alignItems, 'center');
        assert.equal(style.justifyContent, 'center');
        assert.equal(style.flexShrink, '0');
      }
      f.click('[data-bb-chat-ui-info-close]');
    }
  } finally { stop(); f.dom.window.close(); }
});

test("popover scroll hints follow available content, including nested scroll areas, and are cleaned up", async () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-all]');
  const menu = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-menu]')!;
  // JSDOM does not derive overflowY from the popover's overflow shorthand.
  menu.style.overflowY = 'auto';
  let scrollHeight = 600;
  Object.defineProperties(menu, { scrollHeight:{ get:() => scrollHeight }, clientHeight:{ value:200 } });
  const hints = () => ['top', 'bottom'].map(edge => f.document.querySelector<HTMLElement>(`[data-bb-chat-ui-info-scroll-hint="${edge}"]`));
  const scroll = (node: HTMLElement, top: number) => { node.scrollTop = top; node.dispatchEvent(new f.dom.window.Event('scroll')); };
  scroll(menu, 0);
  assert.deepEqual(hints().map(node => node?.hidden), [true, false]);
  scroll(menu, 120);
  assert.deepEqual(hints().map(node => node?.hidden), [false, false]);
  scroll(menu, 400);
  assert.deepEqual(hints().map(node => node?.hidden), [false, true]);
  scrollHeight = 200;
  scroll(menu, 0);
  assert.deepEqual(hints().map(node => node?.hidden), [true, true]);
  f.click('[data-bb-chat-ui-info-choice="queue"]');
  const frame = f.document.querySelector<HTMLElement>('[data-queued-messages-scroll-frame]')!;
  frame.style.overflowY = 'auto';
  Object.defineProperties(frame, { scrollHeight:{ value:500 }, clientHeight:{ value:180 } });
  scroll(frame, 0);
  assert.deepEqual(hints().map(node => node?.hidden), [true, false]);
  scroll(frame, 320);
  assert.deepEqual(hints().map(node => node?.hidden), [false, true]);
  f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  assert.deepEqual(hints().map(node => node?.hidden), [true, true]);
  const before = frame.parentElement;
  stop();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-scroll-hint]'), null);
  assert.equal(frame.parentElement, before, 'native scroll content keeps its original parent');
  f.dom.window.close();
});

test("Diff scroll hints wait for the card entrance to finish before showing at its settled edge", () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    const menu = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-diff]')!;
    Object.defineProperties(menu, { scrollHeight:{ value:600 }, clientHeight:{ value:200 } });
    menu.style.overflowY = 'auto';
    let entering = true;
    menu.getAnimations = () => entering ? [{ animationName:'bb-info-enter', playState:'running' } as CSSAnimation] : [];
    menu.getBoundingClientRect = () => new f.dom.window.DOMRect(0, entering ? 108 : 100, 300, 200);
    menu.dispatchEvent(new f.dom.window.Event('scroll'));
    const bottom = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-scroll-hint="bottom"]')!;
    assert.equal(bottom.hidden, true, 'an opaque sibling fade must not float below a transparent, moving card');
    entering = false;
    menu.dispatchEvent(new f.dom.window.Event('animationend', { bubbles:true }));
    assert.equal(bottom.hidden, false);
    assert.equal(bottom.style.top, '276px', 'the fade uses the settled lower edge, not the entrance offset');
    assert.equal(bottom.style.height, '24px');
  } finally { stop(); f.dom.window.close(); }
});

test("popover wheel scrolling stays inside its scrollable root and nested editors, including empty and edge states", () => {
  const f = fixture();
  let chatWheels = 0;
  f.document.body.addEventListener('wheel', () => { chatWheels++; });
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-all]');
  const menu = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-menu]')!;
  menu.style.overflowY = 'auto';
  let height = 600;
  Object.defineProperties(menu, { scrollHeight:{ get:() => height }, clientHeight:{ value:200 } });
  const wheel = (target:Element, deltaY:number) => {
    const event = new f.dom.window.WheelEvent('wheel', { deltaY, bubbles:true, cancelable:true });
    target.dispatchEvent(event); return event;
  };
  menu.scrollTop = 100;
  assert.equal(wheel(menu.querySelector('button')!,100).defaultPrevented,false,'native scrolling works inside the popup');
  assert.equal(chatWheels,0,'ancestor chat handlers cannot process popup wheel events');
  menu.scrollTop = 400;
  assert.equal(wheel(menu,100).defaultPrevented,true,'bottom edge cannot chain to the chat');
  menu.scrollTop = 0;
  assert.equal(wheel(menu,-100).defaultPrevented,true,'top edge cannot chain to the chat');
  height = 200;
  assert.equal(wheel(menu,100).defaultPrevented,true,'a short popup cannot scroll the chat either');
  const editor = f.document.createElement('textarea'); editor.style.overflowY = 'auto'; menu.append(editor);
  Object.defineProperties(editor, { scrollHeight:{ value:500 }, clientHeight:{ value:100 } });
  assert.equal(wheel(editor,100).defaultPrevented,false,'nested editable content retains native scrolling');
  f.click('[data-bb-chat-ui-info-choice="queue"]');
  const queue = f.document.querySelector<HTMLElement>('[data-queued-messages-scroll-frame]')!;
  queue.style.overflowY = 'auto'; Object.defineProperties(queue,{ scrollHeight:{ value:500 },clientHeight:{ value:180 } });
  assert.equal(wheel(queue,100).defaultPrevented,false,'native queue lists retain scrolling');
  queue.scrollTop = 320;
  assert.equal(wheel(queue,100).defaultPrevented,true);
  assert.equal(chatWheels,0);
  stop();
  assert.equal(wheel(queue,100).defaultPrevented,false,'cleanup restores native event handling');
  assert.equal(chatWheels,1);
  f.dom.window.close();
});

test("single-finger popup gestures do not reach chat handlers or chain from a short popup", () => {
  const f = fixture();
  let chatMoves = 0;
  f.document.body.addEventListener('touchmove', () => { chatMoves++; });
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-all]');
  const menu = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-menu]')!;
  let target:Element = menu;
  const gesture = (type:string,y:number) => {
    const event = new f.dom.window.TouchEvent(type, { bubbles:true,cancelable:true,touches:[{ clientX:30,clientY:y }] });
    target.dispatchEvent(event); return event;
  };
  gesture('touchstart',200);
  assert.equal(gesture('touchmove',180).defaultPrevented,true);
  assert.equal(chatMoves,0);
  menu.style.overflowY = 'auto'; Object.defineProperties(menu,{ scrollHeight:{ value:600 },clientHeight:{ value:200 } });
  assert.equal(gesture('touchmove',160).defaultPrevented,false,'touch can scroll popup content');
  assert.equal(chatMoves,0);
  f.click('[data-bb-chat-ui-info-choice="queue"]');
  target = f.document.querySelector('[data-queued-messages-scroll-frame]')!;
  gesture('touchstart',160);
  stop();
  assert.equal(gesture('touchmove',140).defaultPrevented,false);
  assert.equal(chatMoves,1);
  f.dom.window.close();
});

test("the common pill face excludes active child avatar stacks and preserves the inactive child circle", async () => {
  const f=fixture(),source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-children',JSON.stringify(Array.from({length:4},(_,i)=>({id:String(i),title:`Child ${i}`,state:'run'}))));
  const stop=injectComposerInfo(f.document);
  try {
    const pill=f.document.querySelector('[data-bb-chat-ui-info-trigger="children"]')!;
    const sheet=f.document.getElementById('bb-chat-ui-composer-info') as HTMLStyleElement;
    const face=[...sheet.sheet!.cssRules].find(rule=>'style' in rule&&(rule as CSSStyleRule).style.getPropertyValue('box-shadow').includes('0 6px 18px -12px')) as CSSStyleRule;
    assert.ok(face,'the shared pill face exists');
    // Test selector ownership directly: jsdom does not implement :is() maximum specificity like Chrome.
    for(const expanded of ['false','true']){
      pill.setAttribute('aria-expanded',expanded);
      assert.equal(pill.matches(face.selectorText),false,'the child stack must never receive a rectangular pill face');
      assert.equal(resolvedStyle(pill).boxShadow,'none');
      assert.equal(resolvedStyle(pill).borderTopWidth,'0px');
      for(const circle of pill.querySelectorAll('[data-bb-chat-ui-info-avatar],[data-bb-chat-ui-info-avatar-more]'))assert.equal(resolvedStyle(circle).borderRadius,'50%');
    }
    const goal=f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]')!;
    assert.equal(goal.matches(face.selectorText),true,'ordinary pills keep their surface');
    pill.setAttribute('data-bb-chat-ui-info-unavailable','');
    assert.equal(pill.matches(face.selectorText),true,'the inactive child icon remains a normal circular pill');
    assert.equal(resolvedStyle(pill).borderRadius,'50%');
  } finally {stop();f.dom.window.close();}
});

test("children use a bare latest-three avatar stack and prefer the designed SDK detail", async () => {
  const f = fixture();
  const children = [
    { id:'old',title:'Old review',state:'done' },
    { id:'ui',title:'UI review',state:'run' },
    { id:'qa',title:'Queue check',state:'wait' },
    { id:'diff',title:'Diff review',state:'done' },
  ];
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-children', JSON.stringify(children));
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML('beforeend', '<div data-bb-chat-ui-info-supplements><section data-bb-chat-ui-info-kind="children" aria-label="Child Thread"><h3>Child Threads <button data-bb-chat-ui-info-dismiss="children">×</button></h3><button>Open UI review</button></section></div>');
  const native = f.document.querySelector('section[aria-label="Child threads"]')!;
  const parent = native.parentElement;
  const stop = injectComposerInfo(f.document);
  const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="children"]')!;
  const avatars = pill.querySelectorAll('[data-bb-chat-ui-info-avatar]');
  assert.deepEqual(Array.from(avatars, node => node.getAttribute('data-child')), ['ui','qa','diff']);
  assert.deepEqual(Array.from(avatars, node => node.getAttribute('data-state')), ['run','wait','done']);
  assert.equal(avatars[0].firstChild?.textContent, 'UI');
  assert.ok(avatars[2].querySelector('[data-bb-chat-ui-info-avatar-dot]'));
  assert.equal(avatars[2].querySelector('[data-bb-chat-ui-info-avatar-dot] svg'),null);
  assert.equal(pill.querySelector('[data-bb-chat-ui-info-avatar-more]')!.textContent, '+1');
  assert.equal(resolvedStyle(pill).backgroundColor, 'rgba(0, 0, 0, 0)');
  f.click('[data-bb-chat-ui-info-trigger="children"]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-kind="children"]')!.hasAttribute('data-bb-chat-ui-info-open'));
  assert.equal(native.hasAttribute('data-bb-chat-ui-info-open'), false);
  assert.equal(native.parentElement, parent);
  f.click('[data-bb-chat-ui-info-dismiss="children"]');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-open]'), null);
  stop(); f.dom.window.close();
});

test("an SDK title icon leaves no second empty icon slot when the card opens", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML('beforeend', '<section data-bb-chat-ui-info-kind="children" aria-label="Child Threads"><h3 data-bb-chat-ui-card-head><span data-bb-chat-ui-card-icon><svg data-native-child /></span><span data-bb-chat-ui-card-title>Child Threads</span></h3><button data-bb-chat-ui-info-dismiss="children" data-bb-chat-ui-card-close>×</button></section>');
  const card = stack.querySelector('[data-bb-chat-ui-info-kind="children"]')!;
  const nativeIcon = card.querySelector('[data-bb-chat-ui-card-icon]')!;
  const nativeParent = nativeIcon.parentElement;
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="children"]'); await f.tick();
    assert.equal(resolvedStyle(nativeIcon).display, 'none', 'the replaced icon box must not reserve a second 14px slot and gap');
    const visibleIcons = [...card.querySelectorAll('[data-bb-chat-ui-card-icon]')].filter(icon => resolvedStyle(icon).display !== 'none');
    assert.equal(visibleIcons.length, 1);
    assert.equal(nativeIcon.parentElement, nativeParent);
  } finally { stop(); }
  assert.equal(nativeIcon.hasAttribute('data-bb-chat-ui-info-title-source'), false, 'unload restores the original SDK icon box');
  assert.ok(nativeIcon.hasAttribute('data-bb-chat-ui-card-icon'));
  f.dom.window.close();
});

test("Child Thread rows do not receive the shared button glass face", () => {
  const f=fixture();
  f.document.querySelector('[data-promptbox-shell] > .grid')!.insertAdjacentHTML('beforeend', '<section data-bb-chat-ui-info-kind="children" aria-label="Child Threads"><h3 data-bb-chat-ui-card-head><span data-bb-chat-ui-card-title>Child Threads</span></h3><button data-bb-chat-ui-info-dismiss="children" data-bb-chat-ui-card-close>×</button><div data-bb-chat-ui-card-list><button data-bb-chat-ui-info-child-row data-bb-chat-ui-card-row>Running child</button><button data-bb-chat-ui-info-child-row data-bb-chat-ui-card-row>Completed child</button></div></section>');
  const stop=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="children"]');
    for(const row of f.document.querySelectorAll('[data-bb-chat-ui-info-child-row]')) {
      assert.equal(glassRule(f.document,row),undefined,'each child row stays on the popover face');
      const css=resolvedStyle(row);
      assert.ok(css.backgroundColor==='transparent'||css.backgroundColor==='rgba(0, 0, 0, 0)');
      assert.equal(css.boxShadow,'none');
      assert.equal(css.borderTopWidth,'0px','child rows have no raised upper edge');
      assert.equal(css.getPropertyValue('backdrop-filter'),'none');
    }
    const close=f.document.querySelector('[data-bb-chat-ui-info-kind="children"] [data-bb-chat-ui-info-dismiss]')!;
    assert.equal(glassRule(f.document,close),undefined,'the close sits flat on the card face like every close');
    assert.equal(resolvedStyle(close).position,'absolute');
  } finally {stop();f.dom.window.close();}
});

test("Child Thread and other popover closes have the same button and glyph size", () => {
  const f = fixture();
  f.document.querySelector('[data-promptbox-shell] > .grid')!.insertAdjacentHTML('beforeend', '<section data-bb-chat-ui-info-kind="children" aria-label="Child Thread"><h3 data-bb-chat-ui-card-head><span data-bb-chat-ui-card-title>Child Threads</span></h3><button data-bb-chat-ui-info-dismiss="children" data-bb-chat-ui-card-close>×</button></section>');
  const stop = injectComposerInfo(f.document);
  const check = (button:Element) => {
    const css = resolvedStyle(button);
    assert.equal(css.width,"20px"); assert.equal(css.height,"20px");
    assert.equal(css.fontSize,'12px','close glyph uses the compact menu size');
    assert.equal(css.fontWeight,'400','a heading must not make the close glyph bold');
    assert.equal(css.lineHeight,'1'); assert.equal(css.padding,'0px');
    assert.equal(css.display,'inline-flex'); assert.equal(css.alignItems,'center');
    assert.equal(css.justifyContent,'center');
  };
  try {
    f.click('[data-bb-chat-ui-info-trigger="children"]');
    check(f.document.querySelector('[data-bb-chat-ui-info-dismiss="children"]')!);
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    check(f.document.querySelector('[aria-label="Code Diff 닫기"]')!);
    f.click('[data-bb-chat-ui-info-all]');
    check(f.document.querySelector('[aria-label="전체 정보 닫기"]')!);
    f.click('[data-bb-chat-ui-info-choice="goal"]');
    check(f.document.querySelector('[data-bb-chat-ui-info-native-dismiss]')!);
  } finally { stop(); f.dom.window.close(); }
});

test("child counts use up to three overlapping avatars followed by a separate overflow circle", async () => {
  const f = fixture();
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  const children = Array.from({ length:6 }, (_, index) => ({ id:`child-${index}`, title:`Review ${index}`, state:'run' }));
  source.setAttribute('data-bb-chat-ui-info-children', JSON.stringify(children.slice(0, 1)));
  const stop = injectComposerInfo(f.document);
  for (const count of [1, 2, 3, 4, 6]) {
    source.setAttribute('data-bb-chat-ui-info-children', JSON.stringify(children.slice(0, count)));
    await f.tick();
    const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="children"]')!;
    const stack = pill.querySelector('[data-bb-chat-ui-info-avatars]')!;
    const avatars = Array.from(stack.querySelectorAll('[data-bb-chat-ui-info-avatar]'));
    assert.equal(avatars.length, Math.min(count, 3));
    assert.equal(pill.children.length, 1, 'the count is represented entirely by the avatar stack');
    assert.deepEqual(avatars.map(node => node.getAttribute('data-child')), children.slice(Math.max(0, count - 3), count).map(child => child.id));
    for (let index = 1; index < avatars.length; index++) {
      assert.ok(Number(resolvedStyle(avatars[index]).zIndex) > Number(resolvedStyle(avatars[index - 1]).zIndex), 'newer circles overlap from left to right');
    }
    const more = stack.querySelector('[data-bb-chat-ui-info-avatar-more]');
    if (count <= 3) assert.equal(more, null, 'one to three children have no additional numeric label');
    else {
      assert.ok(more);
      assert.equal(more.textContent, `+${count - 3}`);
      assert.equal(stack.lastElementChild, more);
      const style = resolvedStyle(more);
      assert.equal(style.width, '30px');
      assert.equal(style.height, '30px');
      assert.equal(style.borderRadius, '50%');
      assert.ok(Number(style.zIndex) > Number(resolvedStyle(avatars.at(-1)!).zIndex));
    }
  }
  stop(); f.dom.window.close();
});

test("child avatars use host provider artwork, including late and updated logos, while retaining state dots", async () => {
  const f=fixture();
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-children',JSON.stringify([
    {id:'codex-child',title:'Code review',providerId:'codex',state:'run'},
    {id:'claude-child',title:'UI review',providerId:'claude-code',state:'done',unread:true},
  ]));
  const stop=injectComposerInfo(f.document);
  const avatars=()=>[...f.document.querySelectorAll('[data-bb-chat-ui-info-trigger="children"] [data-bb-chat-ui-info-avatar]')];
  try {
    assert.ok(avatars()[0].textContent?.includes('CR'),'older sources retain title initials until artwork arrives');
    source.insertAdjacentHTML('beforeend','<span data-bb-chat-ui-info-child-icon="codex-child"><span data-provider="codex" style="mask-image:url(/codex.svg)"></span></span><span data-bb-chat-ui-info-child-icon="claude-child"><svg data-provider="claude-code" viewBox="0 0 24 24"><path d="M1 1h1" /></svg></span>');
    await f.tick();
    for(const [index,id] of ['codex','claude-code'].entries()) {
      const avatar=avatars()[index];
      const artwork=avatar.querySelector(`[data-provider="${id}"]`)!;
      assert.ok(artwork,'registered provider artwork replaces initials');
      assert.equal(resolvedStyle(artwork).width,'16px');
      assert.equal(resolvedStyle(artwork).height,'16px');
      assert.ok(avatar.querySelector('[data-bb-chat-ui-info-avatar-dot]'));
      assert.ok(avatar.getAttribute('title')?.includes(id));
    }
    assert.ok(avatars()[0].querySelector('[data-provider]')?.getAttribute('style')?.includes('/codex.svg'));
    assert.equal(avatars()[1].querySelector('[data-bb-chat-ui-info-avatar-dot] svg'),null,'completion uses a dot without a check');
    assert.equal(avatars()[1].getAttribute('data-unread'),'true');
    source.setAttribute('data-bb-chat-ui-info-children',JSON.stringify([
      {id:'codex-child',title:'Code review',providerId:'codex',state:'run'},
      {id:'claude-child',title:'UI review',providerId:'claude-code',state:'done',unread:false},
    ]));await f.tick();
    assert.equal(avatars()[1].getAttribute('data-unread'),'false','reading a child updates its avatar without a runtime status change');
    source.querySelector('[data-bb-chat-ui-info-child-icon="codex-child"] span')!.setAttribute('style','mask-image:url(/codex-updated.svg)');
    source.setAttribute('data-bb-chat-ui-info-child-providers','updated'); await f.tick();
    assert.ok(avatars()[0].querySelector('[data-provider]')?.getAttribute('style')?.includes('/codex-updated.svg'),'provider metadata refresh updates a same-id avatar');
    assert.equal(avatars()[0].hasAttribute('data-new'),false,'artwork arrival does not replay the new-child droplet');
    assert.equal(source.querySelectorAll('[data-bb-chat-ui-info-child-icon]').length,2,'the SDK artwork remains on its original parent');
  } finally {stop();f.dom.window.close();}
});

test("provider artwork style changes are observed as source input without a control mutation", async () => {
  const f=fixture(),source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-children',JSON.stringify([{id:'child',title:'Review',providerId:'codex',state:'run'}]));
  source.insertAdjacentHTML('beforeend','<span data-bb-chat-ui-info-child-icon="child"><span style="mask-image:url(/first.svg)"></span></span>');
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    source.querySelector('[data-bb-chat-ui-info-child-icon] span')!.setAttribute('style','mask-image:url(/updated.svg)');
    await f.tick();
    const artwork=f.document.querySelector('[data-bb-chat-ui-info-avatar] span[style]');
    assert.match(artwork?.getAttribute('style') ?? '', /updated\.svg/);
  } finally {stop();f.dom.window.close();}
});

test("child status dots share the same size and completion uses the thread theme accent", () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>");
  const style = dom.window.document.createElement("style");
  style.textContent = composerInfoCss;
  dom.window.document.head.append(style);
  const stack = dom.window.document.createElement("span");
  stack.setAttribute("data-bb-chat-ui-info-avatars", "");
  for (const state of ["run", "wait", "error", "done"]) {
    const avatar = dom.window.document.createElement("span");
    avatar.setAttribute("data-bb-chat-ui-info-avatar", "");
    avatar.setAttribute("data-state", state);
    const dot = dom.window.document.createElement("span");
    dot.setAttribute("data-bb-chat-ui-info-avatar-dot", "");
    avatar.append(dot);
    stack.append(avatar);
  }
  dom.window.document.body.append(stack);
  const dotOf = (state: string) => resolvedStyle(stack.querySelector(`[data-state="${state}"] [data-bb-chat-ui-info-avatar-dot]`)!);
  try {
    for (const state of ["run", "wait", "error", "done"]) {
      const css = dotOf(state);
      assert.equal(css.left, "0px", state);
      assert.equal(css.right, "auto", state);
      assert.equal(css.bottom, "0px", state);
      assert.equal(css.width, "6px", state);
      assert.equal(css.height, "6px", state);
    }
    const doneRule=[...style.sheet!.cssRules].find(rule=>"selectorText" in rule && rule.selectorText==='[data-bb-chat-ui-info-avatar][data-state="done"] [data-bb-chat-ui-info-avatar-dot]') as CSSStyleRule;
    assert.equal(doneRule.style.background, "var(--subtle-foreground)");
    const unreadRule=[...style.sheet!.cssRules].find(rule=>"selectorText" in rule && rule.selectorText==='[data-bb-chat-ui-info-avatar][data-state="done"][data-unread="true"] [data-bb-chat-ui-info-avatar-dot]') as CSSStyleRule;
    assert.equal(unreadRule.style.background,"var(--timeline-accent)");
  } finally {
    dom.window.close();
  }
});

test("Agentation uses the browser picker icon and count while retaining native controls", async () => {
  const f = fixture();
  const nativeStyle = f.document.createElement('style');
  nativeStyle.textContent = '.overflow-hidden { overflow:hidden; }';
  f.document.head.append(nativeStyle);
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showAnnotations:'상단 표시' }));
  source.insertAdjacentHTML('beforeend', '<span data-bb-chat-ui-info-icon="annotations"><svg data-icon="MessageSquarePlus" data-picker-icon><path d="M1 1h1" /></svg></span>');
  const shell = f.document.createElement('div');
  shell.className = 'agentation-staging-shell';
  stack.append(shell);
  let sent = 0;
  const render = (collapsed: boolean) => {
    shell.classList.toggle('agentation-staging-shell--expanded', !collapsed);
    const icon = '<svg data-icon="ChatFeedback" data-feedback-icon><path d="M9 10h6" /></svg>';
    shell.innerHTML = `<div>${collapsed ? `<button aria-expanded="false" aria-label="Expand 3 staged annotations">${icon}Annotations <span class="tabular-nums">3</span></button>` : `<div>${icon}<p>Annotations</p><button aria-expanded="true" aria-label="Collapse staged annotations"><svg data-chevron /></button></div><div><button data-discard-all title="Original discard hint">Discard all</button><button data-send-all><svg data-native-up><path d="M12 19V5m-7 7 7-7 7 7" /></svg>Send all</button></div>`}</div>
      <div class="grid overflow-hidden"><div class="min-h-0 overflow-hidden"><div><ul>${[1,2,3].map(id => `<li><span class="sr-only">Description ${id}</span><span aria-hidden="true"><span>Composer</span><span>button</span><span>→</span><span>Feedback ${id}</span></span><button aria-label="Mention annotation">Mention</button><button aria-label="Send annotation to this thread">Send</button><button aria-label="Discard annotation"><svg data-native-trash><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14" /></svg>Discard</button></li>`).join('')}</ul></div></div></div>`;
    shell.querySelector('button[aria-expanded]')!.addEventListener('click', () => render(!collapsed));
    shell.querySelector('[data-send-all]')?.addEventListener('click', () => sent++);
  };
  render(true);
  const parent = shell.parentElement;
  const stop = injectComposerInfo(f.document);
  const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="annotations"]')!;
  assert.equal(pill.textContent, '3');
  assert.equal(infoKinds.find(kind => kind.key === 'annotations')!.icon, 'MessageSquarePlus');
  assert.ok(pill.querySelector('[data-picker-icon]'));
  assert.equal(pill.querySelector('[data-feedback-icon]'), null);
  f.click('[data-bb-chat-ui-info-all]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="annotations"] [data-picker-icon]'));
  f.click('[data-bb-chat-ui-info-trigger="annotations"]');
  await f.tick();
  assert.ok(shell.hasAttribute('data-bb-chat-ui-info-open'));
  assert.equal(shell.parentElement, parent);
  assert.equal(resolvedStyle(shell).display, 'grid');
  assert.equal(resolvedStyle(shell).overflow, 'auto', 'the card remains the scroll boundary');
  for (const wrapper of shell.querySelectorAll('.overflow-hidden')) {
    assert.equal(resolvedStyle(wrapper).overflow, 'visible', 'native body wrappers must not clip the widened row background');
  }
  const rowStyle = resolvedStyle(shell.querySelector('li')!);
  assert.equal(rowStyle.paddingLeft, "4px");
  assert.equal(rowStyle.marginLeft, "-4px", 'row content aligns with the heading while hover extends into the gutter');
  assert.ok(pill.querySelector('[data-picker-icon]'), 'expanding the native card keeps the picker glyph');
  assert.ok(decodeURIComponent(stack.style.getPropertyValue('--bb-chat-ui-feedback-icon')).includes('data-picker-icon'), 'popup header and row masks use the picker glyph');
  assert.equal(resolvedStyle(shell.querySelector('[data-feedback-icon]')!).display, 'none', 'the old header icon is hidden without removing its native DOM');
  assert.equal(pill.querySelector('[data-chevron]'), null);
  const send = shell.querySelector('[data-send-all]')!;
  const sendParent = send.parentElement;
  const discard=shell.querySelector<HTMLButtonElement>('[data-discard-all]')!;
  const discardParent=discard.parentElement;
  assert.equal(send.getAttribute('data-bb-chat-ui-info-bulk-action'),'send');
  assert.equal(discard.getAttribute('data-bb-chat-ui-info-bulk-action'),'discard');
  assert.equal(send.getAttribute('aria-label'),'Send all');
  assert.equal(discard.getAttribute('aria-label'),'Discard all');
  assert.equal(send.getAttribute('title'),'Send all');
  assert.equal(discard.getAttribute('title'),'Discard all');
  assert.ok(send.querySelector('[data-bb-chat-ui-info-bulk-icon] [data-native-up], [data-native-up][data-bb-chat-ui-info-bulk-icon]'));
  assert.ok(discard.querySelector('[data-native-trash][data-bb-chat-ui-info-bulk-icon]'));
  for(const button of [send,discard]){
    const css=resolvedStyle(button);
    assert.equal(css.width,"20px",'the shared icon action');assert.equal(css.height,"20px");assert.equal(css.fontSize,'0px');assert.equal(css.padding,'0px');
    assert.equal(css.borderTopWidth,'0px','no bordered square inside the card');
  }
  send.innerHTML='Retry';await f.tick();
  assert.equal(send.getAttribute('data-bb-chat-ui-info-bulk-action'),null,'error recovery stays a readable native button');
  assert.equal(send.getAttribute('aria-label'),null);assert.equal(send.getAttribute('title'),null);
  assert.equal(resolvedStyle(send).borderTopWidth,'1px','a readable recovery action is the shared hairline text action');
  assert.equal(resolvedStyle(send).height,"24px");
  f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target','large');
  assert.equal(resolvedStyle(send).height,"24px",'recovery actions retain the shared touch height');
  assert.equal(resolvedStyle(shell).gridTemplateRows,"30px auto",'a larger action keeps the title on its shared line');
  f.document.documentElement.removeAttribute('data-bb-chat-ui-root-hit-target');
  send.innerHTML='<svg data-native-up><path d="M12 19V5m-7 7 7-7 7 7" /></svg>Sending…';
  (send as HTMLButtonElement).disabled=true;await f.tick();
  assert.equal(send.getAttribute('aria-label'),'Sending…');
  assert.equal(send.querySelectorAll('[data-bb-chat-ui-info-bulk-icon]').length,1);
  (send as HTMLButtonElement).click();assert.equal(sent,0,'native disabled state still blocks sending');
  (send as HTMLButtonElement).disabled=false;
  Array.from(send.childNodes).find(node=>node.nodeType===3)!.textContent='Send all';await f.tick();
  assert.equal(send.getAttribute('aria-label'),'Send all');
  assert.equal(discard.parentElement,discardParent);
  const header=sendParent!.previousElementSibling!;
  const paint=(node:Element)=>resolvedStyle(node);
  const collapse=header.querySelector('[aria-label="Collapse staged annotations"]')!;
  assert.equal(paint(shell).gridTemplateAreas,'"heading actions close" "body body body"');
  assert.equal(paint(shell).gridTemplateColumns,"minmax(0,1fr) auto 20px");
  assert.equal(paint(header).display,'contents','native header children share the same grid row');
  assert.equal(paint(header.querySelector('p')!).gridArea,'heading');
  assert.equal(paint(sendParent!).gridArea,'actions');
  assert.equal(paint(sendParent!).marginTop,'0px');
  assert.ok(collapse.hasAttribute('data-bb-chat-ui-card-close'),'the native collapse is the shared close');
  const crossRule = Array.from(f.document.styleSheets).flatMap(sheet=>Array.from(sheet.cssRules)).find(rule=>'selectorText' in rule && String(rule.selectorText).endsWith('button[aria-label="Collapse staged annotations"]::after')) as CSSStyleRule;
  assert.ok(crossRule);
  assert.equal(crossRule.style.content,'""','Agentation close must not render a platform-font cross');
  assert.match(crossRule.style.getPropertyValue('mask-image'),/data:image\/svg\+xml/);
  assert.equal(crossRule.style.width,'8px');assert.equal(crossRule.style.height,'8px');
  assert.equal(crossRule.style.getPropertyValue('background-color'),'currentcolor');
  assert.equal(paint(collapse).position,'absolute');
  assert.equal(paint(collapse).top,"17px");
  assert.ok(header.querySelector('p')!.hasAttribute('data-bb-chat-ui-card-head'),'the native title is the head line');
  assert.equal(paint(shell).alignItems,'center');
  assert.equal(paint(shell.querySelector('.grid')!).gridArea,'body');
  f.click('[data-send-all]');
  assert.equal(sent, 1);
  assert.equal(send.parentElement, sendParent);
  shell.querySelector('li')!.remove();
  await f.tick();
  assert.equal(pill.textContent, '2');
  f.click('[aria-label="Collapse staged annotations"]');
  await f.tick();
  assert.equal(shell.hasAttribute('data-bb-chat-ui-info-open'), false);
  stop();
  assert.equal(send.getAttribute('data-bb-chat-ui-info-bulk-action'),null);
  assert.equal(send.querySelector('[data-bb-chat-ui-info-bulk-icon]'),null);
  assert.equal(send.getAttribute('aria-label'),null);
  assert.equal(discard.getAttribute('title'),'Original discard hint');
  for (const wrapper of shell.querySelectorAll('.overflow-hidden')) {
    assert.equal(resolvedStyle(wrapper).overflow, 'hidden', 'unloading restores native body clipping');
  }
  f.dom.window.close();
});

test("Agentation replaces its native glyph when the SDK picker icon finishes loading", async () => {
  const f = fixture();
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-settings', '{"showAnnotations":"상단 표시"}');
  source.insertAdjacentHTML('beforeend', '<span data-bb-chat-ui-info-icon="annotations"></span>');
  f.document.querySelector('[data-promptbox-shell] > .grid')!.insertAdjacentHTML('beforeend', '<div class="agentation-staging-shell"><button aria-expanded="false"><svg data-icon="ChatFeedback" /><span class="tabular-nums">2</span></button></div>');
  const stop = injectComposerInfo(f.document);
  try {
    source.querySelector('[data-bb-chat-ui-info-icon="annotations"]')!.innerHTML = '<svg data-icon="MessageSquarePlus"><path d="M1 1h1" /></svg>';
    await f.tick();
    const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="annotations"]')!;
    assert.ok(pill.querySelector('[data-icon="MessageSquarePlus"]'), 'icon readiness refreshes the pill even when the annotation count is unchanged');
    assert.equal(pill.querySelector('[data-icon="ChatFeedback"]'), null);
    assert.equal(pill.textContent, '2');
  } finally { stop(); f.dom.window.close(); }
});

test("opted-in inactive icons honor disabled families and ignore the obsolete empty-icon choice", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  for (const node of [...stack.children]) if (!node.contains(source)) node.remove();
  for (const kind of infoKinds) source.insertAdjacentHTML('beforeend', `<span data-bb-chat-ui-info-icon="${kind.key}"><svg data-placeholder-icon="${kind.key}" /></span>`);
  const settings = { showInactiveInfo:true, showEmptyIcons:false, showAnnotations:'상단 표시', showGoal:'끄기', showPlan:'목록에만 표시' };
  const publish = () => source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify(settings));
  publish();
  const stop = injectComposerInfo(f.document);
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-trigger]').length, 0);
  settings.showEmptyIcons = true; publish(); await f.tick();
  const icons = f.document.querySelectorAll('[data-bb-chat-ui-info-stack-kind]');
  assert.deepEqual([...icons].map(icon => icon.getAttribute('data-bb-chat-ui-info-stack-kind')), ['diff','children','plan']);
  for (const icon of icons) {
    assert.equal(icon.textContent, '');
    assert.ok(icon.querySelector('[data-placeholder-icon]'));
    assert.ok(icon.getAttribute('aria-label')?.includes('현재 없음'));
  }
  f.click('[data-bb-chat-ui-info-stack-kind="diff"]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-empty]')?.textContent?.includes('현재 정보 없음'));
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-stack-kind="diff"]')?.getAttribute('aria-expanded'), 'true');
  const diff = f.document.createElement('span'); diff.hidden = true;
  diff.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify({ insertions:8, deletions:2, files:1, branch:'bb/review' })); stack.append(diff);
  await f.tick();
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.textContent?.includes('+8 −2'));
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.hasAttribute('data-bb-chat-ui-info-unavailable'), false);
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-diff]'));
  settings.showEmptyIcons = false; publish(); await f.tick();
  assert.deepEqual([...f.document.querySelectorAll('[data-bb-chat-ui-info-trigger]')].map(icon => icon.getAttribute('data-bb-chat-ui-info-trigger')), ['diff']);
  f.click('[data-bb-chat-ui-info-all]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="plan"]'));
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-choice="goal"]'), null);
  stop(); f.dom.window.close();
});

test("an empty composer lists every information family without inventing summary data", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  for (const node of Array.from(stack.children).slice(1)) node.remove();
  const stop = injectComposerInfo(f.document);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger]'), null);
  f.click('[aria-label^="전체 정보"]');
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice]').length, infoKinds.length);
  for (const kind of infoKinds) {
    const choice = f.document.querySelector(`[data-bb-chat-ui-info-choice="${kind.key}"]`)!;
    assert.ok(choice.textContent?.includes(kind.label));
    assert.ok(choice.textContent?.includes('현재 없음'));
  }
  f.click('[data-bb-chat-ui-info-choice="diff"]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-empty="diff"]')?.textContent?.includes('현재 정보 없음'));
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-menu]').length, 1);
  assert.equal(f.document.activeElement?.getAttribute('aria-label'), 'Code Diff 닫기');
  f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-menu]'), null);
  assert.ok(f.document.activeElement?.hasAttribute('data-bb-chat-ui-info-all'));
  stop();
  f.dom.window.close();
});

test("an empty disclosure switches to real information when it arrives", async () => {
  const f = fixture();
  const goal = f.document.querySelector('section[aria-label="Goal"]')!;
  const parent = goal.parentElement!;
  goal.remove();
  const stop = injectComposerInfo(f.document);
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="goal"]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-empty="goal"]'));
  parent.append(goal);
  await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-empty]'), null);
  assert.ok(goal.hasAttribute('data-bb-chat-ui-info-open'));
  assert.equal(goal.querySelector('[aria-expanded]')!.getAttribute('aria-expanded'), 'true');
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-open]').length, 1);
  stop();
  f.dom.window.close();
});

test("all information stays reachable; host controls and parents survive a single detail disclosure", async () => {
  const f = fixture();
  const goal = f.document.querySelector('section[aria-label="Goal"]')!;
  const parent = goal.parentElement;
  let cleared = 0;
  goal.querySelector('button[aria-label="Clear active Goal"]')!.addEventListener("click", () => cleared++);
  const stop = injectComposerInfo(f.document);
  f.click('[aria-label^="전체 정보"]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-menu]'));
  for (const key of ["diff", "children", "goal", "todos", "pullRequest", "other", "queue"]) {
    assert.ok(f.document.querySelector(`[data-bb-chat-ui-info-choice="${key}"]`), key);
  }
  f.click('[data-bb-chat-ui-info-choice="goal"]');
  await f.tick();
  assert.equal(goal.querySelector('[aria-expanded]')!.getAttribute("aria-expanded"), "true");
  assert.equal(goal.parentElement, parent);
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-open]').length, 1);
  f.click('[aria-label="Clear active Goal"]');
  assert.equal(cleared, 1);
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="todos"]');
  await f.tick();
  assert.equal(goal.querySelector('[aria-expanded]')!.getAttribute("aria-expanded"), "false");
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-open]').length, 1);
  f.document.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await f.tick();
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-open]').length, 0);
  stop();
  assert.equal(goal.parentElement, parent);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-bar]'), null);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-unit]'), null);
  assert.equal(f.document.querySelector('textarea')!.value, "keep draft");
  f.dom.window.close();
});

test("Diff opens from an icon beside its popover title, preserving the panel action", () => {
  const f = fixture();
  let opened = 0;
  f.document.querySelector('#thread-prompt-banner-git-toggle')!.addEventListener('click', () => opened++);
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  const action = f.document.querySelector('[data-bb-chat-ui-info-action="diff"]')!;
  assert.equal(action.parentElement?.tagName, 'HEADER');
  assert.equal(action.previousElementSibling?.textContent, 'Code Diff');
  assert.equal(action.textContent, '');
  assert.ok(action.querySelector('svg'));
  assert.equal(action.getAttribute('aria-label'), 'Diff 패널 열기');
  assert.equal(action.getAttribute('title'), 'Diff 패널 열기');
  (action as HTMLElement).click();
  assert.equal(opened, 1);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff]'), null);
  stop(); f.dom.window.close();
});

test("native panel and plugin-page actions become title icons without moving original controls", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML('beforeend', '<section data-bb-chat-ui-info-kind="workflow" aria-label="Workflow"><h3>UI review</h3><div><button>사이드 패널에서 열기</button><a href="/plugins/workflows">플러그인 페이지에서 열기</a><button>Stop workflow</button></div></section>');
  const node = stack.querySelector('[data-bb-chat-ui-info-kind="workflow"]')!;
  const panel = node.querySelector('button')!;
  const page = node.querySelector('a')!;
  const parent = panel.parentElement;
  let opened = 0;
  panel.addEventListener('click', () => opened++);
  page.addEventListener('click', event => { event.preventDefault(); opened += 10; });
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-all]'); f.click('[data-bb-chat-ui-info-choice="workflow"]');
  const icons = node.querySelectorAll<HTMLElement>('h3 [data-bb-chat-ui-info-panel-action]');
  assert.equal(icons.length, 2);
  for (const icon of icons) { assert.equal(icon.textContent, ''); assert.ok(icon.querySelector('svg')); }
  assert.equal(icons[0].getAttribute('title'), '사이드 패널에서 열기');
  assert.equal(icons[1].getAttribute('aria-label'), '플러그인 페이지에서 열기');
  assert.equal(panel.parentElement, parent); assert.equal(page.parentElement, parent);
  assert.equal(resolvedStyle(panel).display, 'none');
  assert.equal(resolvedStyle(page).display, 'none');
  assert.equal(node.querySelectorAll('[data-bb-chat-ui-info-panel-source]').length, 2);
  assert.equal(parent?.querySelector('button:last-child')?.textContent, 'Stop workflow');
  assert.equal(parent?.querySelector('button:last-child')?.hasAttribute('data-bb-chat-ui-info-panel-source'), false);
  icons[0].click(); icons[1].click(); assert.equal(opened, 11);
  panel.disabled = true; await f.tick();
  assert.equal((icons[0] as HTMLButtonElement).disabled, true);
  icons[0].click(); assert.equal(opened, 11);
  page.remove(); await f.tick();
  assert.equal(node.querySelectorAll('[data-bb-chat-ui-info-panel-action]').length, 1);
  stop();
  assert.equal(node.querySelector('[data-bb-chat-ui-info-panel-action]'), null);
  assert.equal(panel.hasAttribute('data-bb-chat-ui-info-panel-source'), false);
  assert.equal(panel.parentElement, parent);
  f.dom.window.close();
});

test("panel icons follow native rerenders and never appear when no destination exists", async () => {
  const f = fixture();
  const node = f.document.querySelector('[aria-label="Goal"]')!;
  const stop = injectComposerInfo(f.document);
  assert.equal(node.querySelector('[data-bb-chat-ui-info-panel-action]'), null);
  const source = f.document.createElement('button'); source.textContent = 'Open in side panel'; node.append(source);
  await f.tick();
  assert.equal(node.querySelector('h3')?.textContent, 'Goal');
  assert.equal(node.querySelectorAll('[data-bb-chat-ui-info-panel-action]').length, 1);
  node.innerHTML = '<h3>Updated Goal</h3><button title="Open plugin page">Open</button><button>Clear</button>';
  await f.tick();
  assert.equal(node.querySelectorAll('h3').length, 1);
  assert.equal(node.querySelectorAll('[data-bb-chat-ui-info-panel-action]').length, 1);
  const page = node.querySelector('button[title]:not([data-bb-chat-ui-info-panel-action])')!;
  page.setAttribute('title', 'Open ordinary details'); await f.tick();
  assert.equal(node.querySelector('[data-bb-chat-ui-info-panel-action]'), null);
  assert.equal(page.hasAttribute('data-bb-chat-ui-info-panel-source'), false);
  stop();
  assert.equal(node.querySelector('h3')?.textContent, 'Updated Goal');
  f.dom.window.close();
});

test("settings change exposed summaries without removing menu entries or losing Diff action", async () => {
  const f = fixture();
  let diffOpened = 0;
  f.document.querySelector('#thread-prompt-banner-git-toggle')!.addEventListener("click", () => diffOpened++);
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  assert.equal(diffOpened, 0);
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-diff]')?.textContent?.includes('+12 −4 · 3 files'));
  f.click('[data-bb-chat-ui-info-action="diff"]');
  assert.equal(diffOpened, 1);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff]'), null);
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute("data-bb-chat-ui-info-settings", JSON.stringify({ showDiff: false, showGoal: true }));
  await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'), null);
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]'));
  f.click('[aria-label^="전체 정보"]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="diff"]'));
  stop();
  f.dom.window.close();
});

test("Diff first opens one dismissible popover from either the pill or the catalog", async () => {
  const f = fixture();
  let diffOpened = 0;
  const native = f.document.querySelector('#thread-prompt-banner-git-toggle')!;
  const parent = native.parentElement;
  native.addEventListener('click', () => diffOpened++);
  const stop = injectComposerInfo(f.document);
  const pill = f.click('[data-bb-chat-ui-info-trigger="diff"]');
  assert.equal(pill.getAttribute('aria-expanded'), 'true');
  assert.equal(diffOpened, 0);
  assert.equal(native.parentElement, parent);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-menu]'), null);
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="diff"]');
  assert.equal(diffOpened, 0);
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-menu]').length, 1);
  assert.equal(f.document.activeElement?.getAttribute('aria-label'), 'Diff 패널 열기');
  native.textContent = '+20 −5 · 4 files';
  await f.tick();
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-diff]')?.textContent?.includes('+20 −5 · 4 files'));
  f.document.dispatchEvent(new f.dom.window.KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-menu]'), null);
  assert.equal(diffOpened, 0);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  f.click('[data-bb-chat-ui-info-trigger="children"]');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff]'), null);
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-open]').length, 1);
  stop(); f.dom.window.close();
});

test("Diff popover uses compact HEAD and commit metadata without losing comparison meaning or inventing counts", async () => {
  const f = fixture();
  const source = f.document.createElement('span');
  const detail = { branch:'feature/chat', basis:'HEAD 대비 미커밋 변경', baseRef:'origin/main', files:[],
    commitKind:'pr', commitCount:28 as number | null, commits:[{ sha:'abc1234', shortSha:'abc1234', subject:'Latest' }] };
  const publish = () => source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({insertions:0,deletions:0,files:0,detail}));
  publish(); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  const popup = f.document.querySelector('[data-bb-chat-ui-info-diff]')!;
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-meta="head"]')?.textContent, 'HEAD · +0 −0 · 0 files');
  assert.ok(popup.querySelector('[data-bb-chat-ui-info-diff-meta="head"]')?.getAttribute('title')?.includes('미커밋'));
  const commits = () => popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')!;
  assert.equal(commits().textContent, 'origin/main → HEAD · 28');
  assert.ok(commits().getAttribute('aria-label')?.includes('PR 후보'));
  assert.equal(commits().querySelector('[data-bb-chat-ui-info-commit-count]')?.getAttribute('aria-label'), '커밋 28개');
  assert.ok(commits().querySelector('svg'));
  assert.equal(commits().textContent?.includes('commits'), false);
  detail.commitCount = null; publish(); await f.tick();
  assert.equal(commits().textContent, 'origin/main → HEAD · —');
  assert.equal(commits().querySelector('[data-bb-chat-ui-info-commit-count]')?.getAttribute('aria-label'), '커밋 수 확인 불가');
  detail.commitCount = 0; publish(); await f.tick();
  assert.equal(commits().textContent, 'origin/main → HEAD · 0');
  stop(); f.dom.window.close();
});

test("Diff popover retains changed files, line statistics, comparison basis and actual branch commits while open", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const source = f.document.createElement('span');
  const detail = {
    branch:'bb/review', basis:'HEAD 대비 미커밋 변경', baseRef:'main',
    files:[{ path:'app.tsx', status:'M', insertions:8, deletions:2 },{ path:'image.png', status:'A', insertions:null, deletions:null }],
    commits:[{ sha:'a7c21f0abcdef', shortSha:'a7c21f0', subject:'컴포저 정보 정리' }],
  };
  const publish = () => source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify({ insertions:8, deletions:2, files:2, branch:'bb/review', detail }));
  publish(); stack.append(source);
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  const popup = f.document.querySelector('[data-bb-chat-ui-info-diff]')!;
  assert.ok(popup.querySelector('[data-bb-chat-ui-info-diff-meta="head"]')?.getAttribute('title')?.includes('HEAD 대비 미커밋 변경'));
  const rows = popup.querySelectorAll('[data-bb-chat-ui-info-diff-file]');
  assert.equal(rows.length, 2);
  assert.ok(rows[0].textContent?.includes('app.tsx'));
  assert.ok(rows[0].textContent?.includes('+8'));
  assert.ok(rows[0].textContent?.includes('−2'));
  assert.ok(rows[1].textContent?.includes('통계 없음'));
  assert.ok(popup.textContent?.includes('a7c21f0 · 컴포저 정보 정리'));
  assert.ok(popup.textContent?.includes('main → HEAD'));
  assert.equal(popup.textContent?.includes('unpushed'), false);
  detail.files[0].path = 'lib/composer.ts';
  publish(); await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff]'), popup);
  assert.ok(popup.textContent?.includes('lib/composer.ts'));
  assert.equal(popup.textContent?.includes('app.tsx'), false);
  assert.equal(popup.querySelectorAll('[data-bb-chat-ui-info-action="diff"]').length, 1);
  stop(); f.dom.window.close();
});

test("read-only Diff summaries show real branch information and defer the scoped panel action", async t => {
  const f = fixture();
  const previousButton = Object.getOwnPropertyDescriptor(globalThis, 'HTMLButtonElement');
  Object.defineProperty(globalThis, 'HTMLButtonElement', { configurable:true, value:f.dom.window.HTMLButtonElement });
  t.after(() => {
    if (previousButton) Object.defineProperty(globalThis, 'HTMLButtonElement', previousButton);
    else Reflect.deleteProperty(globalThis, 'HTMLButtonElement');
  });
  f.document.querySelector('section[aria-label="Thread context before sending"]')!.remove();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const source = f.document.createElement('span');
  source.hidden = true;
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify({ insertions:8, deletions:2, files:3, branch:'bb/review' }));
  stack.append(source);
  const panel = f.document.createElement('button');
  panel.setAttribute('aria-label', 'Show diff panel');
  panel.getClientRects = () => [new f.dom.window.DOMRect(0,0,32,32)] as unknown as DOMRectList;
  f.document.body.append(panel);
  let opened = 0;
  panel.addEventListener('click', () => opened++);
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  assert.equal(opened, 0);
  const popover = f.document.querySelector('[data-bb-chat-ui-info-diff]')!;
  assert.ok(popover.textContent?.includes('+8 −2 · 3 files'));
  assert.ok(popover.textContent?.includes('Branch · bb/review'));
  f.click('[data-bb-chat-ui-info-action="diff"]');
  assert.equal(opened, 1);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff]'), null);
  stop(); f.dom.window.close();
});

test("visibility settings remove disabled live and empty families from the row and catalog", async () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="goal"]');
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showInactiveInfo:true, showGoal:'끄기', showDiff:'끄기', showWorkflow:'끄기', showChildren:'목록에만 표시' }));
  await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-open]'), null);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'), null);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="children"]'), null);
  f.click('[aria-label^="전체 정보"]');
  for (const key of ['diff','goal','workflow']) assert.equal(f.document.querySelector(`[data-bb-chat-ui-info-choice="${key}"]`), null, key);
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="children"]'));
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice]').length, infoKinds.length - 3);
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showInactiveInfo:true, showGoal:'상단 표시', showWorkflow:'목록에만 표시' }));
  await f.tick();
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]'));
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="workflow"]')?.textContent?.includes('현재 없음'));
  f.click('[data-bb-chat-ui-info-choice="workflow"]');
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showInactiveInfo:true, showWorkflow:'끄기' }));
  await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-empty]'), null);
  source.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify(Object.fromEntries(infoKinds.map(kind => [kind.setting,'끄기']))));
  await f.tick();
  assert.equal((f.document.querySelector('[data-bb-chat-ui-info-bar]') as HTMLElement).hidden, true);
  assert.equal(f.document.querySelector('textarea')!.value, 'keep draft');
  source.setAttribute('data-bb-chat-ui-info-settings', '{}');
  await f.tick();
  assert.equal((f.document.querySelector('[data-bb-chat-ui-info-bar]') as HTMLElement).hidden, false);
  stop(); f.dom.window.close();
});

test("disabling the queue preserves an in-progress edit and hides its detail when editing ends", async () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="queue"]');
  const queue = f.document.querySelector('section[aria-label="Queued messages"]')!;
  queue.insertAdjacentHTML('beforeend', '<textarea data-queued-message-inline-editor>unsaved edit</textarea>');
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({ showQueue:'끄기' }));
  await f.tick();
  assert.ok(queue.hasAttribute('data-bb-chat-ui-info-open'));
  assert.equal(queue.querySelector('textarea')!.value, 'unsaved edit');
  queue.querySelector('textarea')!.remove();
  await f.tick();
  assert.equal(queue.hasAttribute('data-bb-chat-ui-info-open'), false);
  f.click('[aria-label^="전체 정보"]');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-choice="queue"]'), null);
  stop(); f.dom.window.close();
});

test("current and child requests suppress information and the editor, and resolution restores the draft", async () => {
  for (const id of ["tool-use-ask", "plugin-request-banner", "plan-review-request", "approval-banner", "user-question-banner", "plan-review-banner"]) {
    const f = fixture();
    const stop = injectComposerInfo(f.document);
    const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
    const request = f.document.createElement("section");
    request.setAttribute("data-testid", id);
    request.setAttribute("aria-label", "Needs your input");
    request.innerHTML = '<button>Answer</button>';
    stack.prepend(request);
    await f.tick();
    assert.ok(stack.hasAttribute("data-bb-chat-ui-info-request"));
    assert.equal(request.hasAttribute("data-bb-chat-ui-info-unit"), false);
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-bar]')!.getAttribute("hidden"), "");
    request.remove();
    await f.tick();
    assert.equal(stack.hasAttribute("data-bb-chat-ui-info-request"), false);
    assert.equal(f.document.querySelector('textarea')!.value, "keep draft");
    stop();
    f.dom.window.close();
  }
});

test("composer question cards have rounded corners and a gentle entrance without changing native answers", async () => {
  for (const id of ['tool-use-ask','plugin-request-banner','user-question-banner']) {
    const f=fixture();
    const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
    const outside=f.document.createElement('section'); outside.setAttribute('data-testid',id); outside.style.borderRadius='4px'; f.document.body.append(outside);
    const question=f.document.createElement('section'); question.setAttribute('data-testid',id);
    question.innerHTML='<p>Which option?</p><button type="button">Option A</button><textarea>Custom answer</textarea><button type="button">Submit</button>';
    if (id === 'plugin-request-banner') {
      const nativeCss=f.document.createElement('style'); nativeCss.textContent='.rounded-lg { border-radius:4px; } .mb-2 { margin-bottom:8px; }'; f.document.head.append(nativeCss);
      question.innerHTML=`<section data-testid="plugin-interaction-shell" class="rounded-lg mb-2">${question.innerHTML}</section>`;
    }
    stack.prepend(question);
    const answer=question.querySelector('button')!; const parent=answer.parentElement;
    let selected=0; answer.addEventListener('click',()=>selected++);
    const stop=injectComposerInfo(f.document);
    try {
      await f.tick();
      const css=resolvedStyle(question);
      assert.equal(css.borderRadius,'18px',id);
      assert.ok(css.animation.includes('bb-info-enter 260ms'),id);
      assert.equal(css.overflow,'hidden','the card surface clips to its rounded edge');
      const nested=question.querySelector('[data-testid="plugin-interaction-shell"]');
      if (nested) assert.equal(resolvedStyle(nested).borderRadius,'18px','the visible nested card also rounds its bottom edge above its native margin');
      answer.click(); assert.equal(selected,1); assert.equal(answer.parentElement,parent);
      assert.equal(question.querySelector('textarea')!.value,'Custom answer');
      assert.equal(resolvedStyle(outside).borderRadius,'4px','past questions outside the composer are unchanged');
      stop();
      assert.equal(resolvedStyle(question).borderRadius,'','unloading restores native styling');
      if (nested) assert.equal(resolvedStyle(nested).borderRadius,'4px','unloading restores the nested native surface');
    } finally {stop();f.dom.window.close();}
  }
});

// Read every connected information stylesheet in its cascade order.
function glassSource(document: Document): string {
  return Array.from(document.querySelectorAll<HTMLStyleElement>('style[id="bb-chat-ui-composer-info"], style[id="bb-chat-ui-composer-info-workflow"], style[id="bb-chat-ui-composer-info-tail"]')).map(style => style.textContent ?? "").join("");
}

function glassRule(document: Document, element: Element): CSSStyleRule | undefined {
  for (const sheet of [...document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      if (!(rule instanceof (document.defaultView as { CSSStyleRule: typeof CSSStyleRule }).CSSStyleRule)) continue;
      if (!rule.selectorText || !element.matches(rule.selectorText)) continue;
      if (rule.style.getPropertyValue("backdrop-filter") === "blur(14px) saturate(1.25)") return rule;
    }
  }
  return undefined;
}

const NATIVE_CARD_CSS = `.bg-surface-recessed { background-color: color-mix(in oklab, black 6%, transparent); } .bg-card { background-color: white; } .border { border: 1px solid #ccc; }`;

test("composer question cards frost once with the theme glass and keep nested answers native", async () => {
  const surfaces = [
    ["user-question-banner", "section", "bg-surface-recessed border"],
    ["tool-use-ask", "div", "bg-card border"],
    ["approval-banner", "section", "bg-surface-recessed border"],
    ["plan-review-banner", "section", "bg-surface-recessed border"],
  ] as const;
  for (const [id, tag, cls] of surfaces) {
    const f = fixture();
    const native = f.document.createElement("style");
    native.textContent = NATIVE_CARD_CSS;
    f.document.head.append(native);
    const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
    const outside = f.document.createElement(tag);
    outside.setAttribute("data-testid", id);
    outside.className = cls;
    f.document.body.append(outside);
    const card = f.document.createElement(tag);
    card.setAttribute("data-testid", id);
    card.className = cls;
    card.innerHTML = '<p>Which option?</p><button type="button">Option A</button><textarea>Custom answer</textarea><button type="submit">Submit</button>';
    if (id === "plan-review-banner") card.insertAdjacentHTML("beforeend", '<div data-testid="plan-review-request" class="bg-card">Plan body</div>');
    stack.prepend(card);
    const stop = injectComposerInfo(f.document);
    try {
      await f.tick();
      const css = resolvedStyle(card);
      const glass = glassRule(f.document, card);
      assert.ok(glass, id);
      assert.equal(css.backdropFilter, "blur(14px) saturate(1.25)", id);
      assert.equal(glass.style.getPropertyValue("background"), "var(--bb-chat-ui-info-face)", id);
      assert.equal(glass.style.getPropertyPriority("background"), "important", id);
      assert.match(glassSource(f.document), /-webkit-backdrop-filter:blur\(14px\) saturate\(1\.25\)/);
      assert.equal(css.borderTopColor, "rgba(0, 0, 0, 0)", `${id} uses the glass edge instead of a solid border`);
      assert.ok(css.boxShadow.includes("inset"), id);
      assert.equal(resolvedStyle(outside).backdropFilter, "none", `${id} outside the composer stays native`);
      const nestedPlan = card.querySelector('[data-testid="plan-review-request"]');
      if (nestedPlan) {
        assert.equal(resolvedStyle(nestedPlan).backdropFilter, "none", "the plan body keeps its own fill");
        assert.equal(glassRule(f.document, nestedPlan), undefined);
      }
      f.document.documentElement.classList.add("dark");
      assert.match(resolvedStyle(stack).getPropertyValue("--bb-chat-ui-info-face"), /\/\s*0\.76\)/, `${id} dark glass`);
      f.document.documentElement.classList.remove("dark");
      assert.match(resolvedStyle(stack).getPropertyValue("--bb-chat-ui-info-face"), /\/\s*0\.68\)/, `${id} light glass`);
    } finally { stop(); f.dom.window.close(); }
  }

  const f = fixture();
  const native = f.document.createElement("style");
  native.textContent = NATIVE_CARD_CSS;
  f.document.head.append(native);
  const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
  const banner = f.document.createElement("div");
  banner.setAttribute("data-testid", "plugin-request-banner");
  banner.innerHTML = '<section data-testid="plugin-interaction-shell" class="bg-surface-recessed border"><form><label>API_TOKEN<input type="password" value="dummy"></label><button type="button">Cancel</button><button type="submit">Add</button></form></section>';
  stack.prepend(banner);
  const shell = banner.querySelector("section")!;
  const button = shell.querySelector("button")!;
  let clicks = 0;
  button.addEventListener("click", () => clicks++);
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick();
    const wrap = resolvedStyle(banner);
    const face = resolvedStyle(shell);
    assert.equal(wrap.backdropFilter, "none", "the request wrapper must not add a second blur");
    assert.equal(glassRule(f.document, banner), undefined);
    assert.equal(wrap.backgroundColor, "rgba(0, 0, 0, 0)");
    const shellRule = glassRule(f.document, shell);
    assert.ok(shellRule);
    assert.equal(face.backdropFilter, "blur(14px) saturate(1.25)");
    assert.equal(shellRule.style.getPropertyValue("background"), "var(--bb-chat-ui-info-face)");
    assert.match(glassSource(f.document), /plugin-interaction-shell"\] \{[^}]*-webkit-backdrop-filter:blur\(14px\) saturate\(1\.25\)/);
    assert.notEqual(face.backgroundColor, "rgba(0, 0, 0, 0.06)");
    assert.ok(wrap.animation.includes("bb-info-enter 260ms"), "the entrance stays on the wrapper");
    assert.equal(face.animationName, "none", "the nested shell does not replay the entrance");
    assert.equal(face.borderRadius, "18px");
    assert.equal(face.overflow, "hidden");
    button.click();
    assert.equal(clicks, 1);
    assert.equal(shell.querySelector("input")!.value, "dummy");
    stop();
    assert.equal(resolvedStyle(shell).backdropFilter, "none", "unloading restores the native shell");
  } finally { stop(); f.dom.window.close(); }
});

test("plan and approval cards round and clip the outer surface in both shell states", async () => {
  for (const id of ["plan-review-banner", "approval-banner"] as const) {
    for (const expanded of [false, true]) {
      const f = fixture();
      const native = f.document.createElement("style");
      native.textContent = NATIVE_CARD_CSS;
      f.document.head.append(native);
      const stack = f.document.querySelector<HTMLElement>("[data-promptbox-shell] > .grid")!;
      const card = f.document.createElement("section");
      card.setAttribute("data-testid", id);
      card.className = "bg-surface-recessed border";
      if (expanded) card.setAttribute("data-expanded", "");
      card.innerHTML = '<p>Which option?</p><button type="button">Option A</button><button type="submit">Submit</button>';
      if (id === "plan-review-banner") card.insertAdjacentHTML("beforeend", '<div data-testid="plan-review-request" class="bg-card"><div class="overflow-auto">Plan body</div></div>');
      stack.prepend(card);
      const stop = injectComposerInfo(f.document);
      try {
        await f.tick();
        const css = resolvedStyle(card);
        const state = expanded ? "expanded" : "collapsed";
        assert.equal(css.borderRadius, "18px", `${id} ${state} rounds every outer corner`);
        assert.equal(css.overflow, "hidden", `${id} ${state} clips to the outer radius`);
        assert.equal(css.animationName, "none", `${id} does not gain an entrance`);
        const request = card.querySelector('[data-testid="plan-review-request"]');
        if (request) {
          const body = resolvedStyle(request);
          assert.equal(body.borderRadius, "0px", "the plan body stays square");
          assert.equal(body.overflow, "visible");
          assert.equal(body.backgroundColor, "rgba(0, 0, 0, 0)");
        }
        const fade = f.document.querySelector("[data-bb-chat-ui-info-body-fade]");
        if (id === "plan-review-banner") {
          assert.ok(fade, "the plan body still has a scroll fade");
          assert.equal(fade!.parentElement, stack, "the scroll fade stays outside the clipped card");
          assert.equal(card.contains(fade), false);
          assert.equal(resolvedStyle(stack).overflow, "visible");
        }
      } finally { stop(); f.dom.window.close(); }
    }
  }
});

test("a collapsed secret card sits on the composer edge and keeps its label centered", async () => {
  const f = fixture();
  const native = f.document.createElement("style");
  native.textContent = ".mb-2 { margin-bottom: 8px; } .space-y-2 > :not(:last-child) { margin-bottom: 8px; } .items-start { align-items: flex-start; } .items-center { align-items: center; }";
  f.document.head.append(native);
  const shell = f.document.querySelector("[data-promptbox-shell]")!;
  shell.classList.add("space-y-2");
  const stack = shell.querySelector(":scope > .grid")!;
  const banner = f.document.createElement("div");
  banner.setAttribute("data-testid", "plugin-request-banner");
  banner.innerHTML = '<section data-testid="plugin-interaction-shell" class="mb-2" aria-label="Add secrets"><div class="flex items-center"><button type="button" aria-expanded="false" aria-label="Add secrets"><span class="flex items-start"><span>Add secrets</span></span></button><button type="button" aria-label="Show details">Show</button></div></section>';
  stack.prepend(banner);
  const card = banner.querySelector("section")!;
  const label = card.querySelector("span")!;
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick();
    const css = resolvedStyle(card);
    const row = resolvedStyle(stack);
    assert.equal(css.marginBottom, "0px", "collapsed card drops the native bottom margin");
    assert.equal(row.marginBottom, "0px", "the hidden composer no longer leaves a space-y gap");
    assert.equal(resolvedStyle(label).alignItems, "center");
    assert.equal(css.borderRadius, "18px");
    assert.ok(resolvedStyle(banner).animation.includes("bb-info-enter 260ms"));
    card.setAttribute("data-expanded", "");
    // Marker styling settles at the mutation checkpoint before paint, without a layout frame.
    await Promise.resolve(); await Promise.resolve();
    assert.equal(resolvedStyle(card).marginBottom, "8px", "an open card keeps its bottom margin");
    assert.equal(resolvedStyle(stack).marginBottom, "8px");
  } finally { stop(); f.dom.window.close(); }
});

test("secret action row drops its solid fill and divider without a second blur", async () => {
  const f = fixture();
  const native = f.document.createElement("style");
  native.textContent = ".bg-surface-recessed-solid { background-color: rgb(210, 210, 214); } .border-t { border-top: 1px solid rgba(0, 0, 0, 0.7); }";
  f.document.head.append(native);
  const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
  const banner = f.document.createElement("div");
  banner.setAttribute("data-testid", "plugin-request-banner");
  banner.innerHTML = '<section data-testid="plugin-interaction-shell" data-expanded=""><form class="@container/secrets"><label>API_TOKEN<input type="password" value="dummy"></label><div class="sticky border-t bg-surface-recessed-solid"><button type="button">Cancel</button><button type="submit">Add secrets</button></div></form></section>';
  stack.prepend(banner);
  const shell = banner.querySelector("section")!;
  const row = shell.querySelector(".sticky")!;
  const submit = shell.querySelector('button[type="submit"]')!;
  let submits = 0;
  shell.querySelector("form")!.addEventListener("submit", event => { event.preventDefault(); submits++; });
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick();
    const css = resolvedStyle(row);
    const face = resolvedStyle(shell);
    assert.equal(css.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(css.borderTopWidth, "0px");
    assert.equal(css.backdropFilter, "none", "the action row must not add a second blur");
    assert.equal(face.backdropFilter, "blur(14px) saturate(1.25)", "the shell keeps the one glass layer");
    assert.equal(shell.querySelector("input")!.value, "dummy");
    submit.click();
    assert.equal(submits, 1);
  } finally { stop(); f.dom.window.close(); }
});

test("secret scroll edge drops the header hairline and keeps the glass shell", async () => {
  const f = fixture();
  const native = f.document.createElement("style");
  native.textContent = ".border-b { border-bottom-style: solid; border-bottom-width: 1px; } .border-border-hairline { border-color: rgb(222, 222, 222); } .overflow-y-auto { overflow-y: auto; } .bg-surface-recessed-solid { background-color: rgb(210, 210, 214); } .border-t { border-top: 1px solid rgba(0, 0, 0, 0.7); }";
  f.document.head.append(native);
  const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
  const banner = f.document.createElement("div");
  banner.setAttribute("data-testid", "plugin-request-banner");
  banner.innerHTML = '<section data-testid="plugin-interaction-shell" data-expanded=""><div class="border-b border-border-hairline"><button type="button" aria-label="Add secrets">Add secrets</button></div><div class="overflow-y-auto"><form class="@container/secrets"><label>UI_PREVIEW_TOKEN<input type="password" value="dummy"></label><div class="sticky border-t bg-surface-recessed-solid"><button type="submit">Add secrets</button></div></form></div></section>';
  const other = f.document.createElement("div");
  other.setAttribute("data-testid", "plugin-request-banner");
  other.innerHTML = '<section data-testid="plugin-interaction-shell" data-expanded=""><div class="border-b border-border-hairline"><button type="button">Other request</button></div><div class="overflow-y-auto"><form><button type="button">Continue</button></form></div></section>';
  stack.prepend(other, banner);
  const shell = banner.querySelector("section")!;
  const header = shell.firstElementChild!;
  const scroll = shell.querySelector(".overflow-y-auto")!;
  const otherHeader = other.querySelector("section > div")!;
  let submits = 0;
  shell.querySelector("form")!.addEventListener("submit", event => { event.preventDefault(); submits++; });
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick();
    const edge = resolvedStyle(header);
    const face = resolvedStyle(shell);
    const row = resolvedStyle(shell.querySelector(".sticky")!);
    assert.equal(edge.borderBottomColor, "rgba(0, 0, 0, 0)", "the secret header hairline is not a solid line on the scroll edge");
    assert.equal(edge.borderBottomWidth, "1px", "clearing the color keeps the header box");
    assert.equal(resolvedStyle(otherHeader).borderBottomColor, "rgb(222, 222, 222)", "other request cards keep their header line");
    assert.equal(face.backdropFilter, "blur(14px) saturate(1.25)");
    assert.ok(face.boxShadow.includes("inset"), "the shell keeps its soft inset edge");
    assert.equal(face.borderRadius, "18px");
    assert.equal(resolvedStyle(scroll).overflowY, "auto");
    assert.equal(row.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(row.borderTopWidth, "0px");
    assert.equal(row.backdropFilter, "none");
    assert.equal((shell.querySelector("input") as HTMLInputElement).value, "dummy");
    shell.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    assert.equal(submits, 1);
    f.document.documentElement.classList.add("dark");
    assert.equal(resolvedStyle(header).borderBottomColor, "rgba(0, 0, 0, 0)");
    assert.match(resolvedStyle(stack).getPropertyValue("--bb-chat-ui-info-face"), /\/\s*0\.76\)/);
  } finally { stop(); f.dom.window.close(); }
});

test("secret card height eases between the open body and the header instead of snapping", async () => {
  const f = fixture();
  let reduce = false;
  Object.defineProperty(f.dom.window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: query.includes("prefers-reduced-motion") && reduce }),
  });
  const native = f.document.createElement("style");
  native.textContent = ".border-b { border-bottom: 1px solid rgb(222, 222, 222); } .overflow-y-auto { overflow-y: auto; } .bg-surface-recessed-solid { background-color: rgb(210, 210, 214); } .border-t { border-top: 1px solid rgba(0, 0, 0, 0.7); }";
  f.document.head.append(native);
  const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
  const banner = f.document.createElement("div");
  banner.setAttribute("data-testid", "plugin-request-banner");
  banner.innerHTML = '<section data-testid="plugin-interaction-shell" data-expanded=""><div class="border-b border-border-hairline py-1.5"><button type="button" aria-label="Add secrets">Add secrets</button><button type="button" aria-label="Hide details">Hide</button></div><div data-secret-body class="overflow-y-auto"><form class="@container/secrets"><label>UI_PREVIEW_TOKEN<input type="password" value="dummy"></label><div class="sticky border-t bg-surface-recessed-solid"><button type="submit">Add secrets</button></div></form></div></section>';
  const other = f.document.createElement("div");
  other.setAttribute("data-testid", "plugin-request-banner");
  other.innerHTML = '<section data-testid="plugin-interaction-shell" data-expanded=""><div class="border-b border-border-hairline"><button type="button">Other request</button></div><div class="overflow-y-auto"><form><button type="button">Continue</button></form></div></section>';
  stack.prepend(other, banner);
  const shell = banner.querySelector("section")!;
  const body = shell.querySelector<HTMLElement>("[data-secret-body]")!;
  const form = shell.querySelector("form")!;
  const input = shell.querySelector("input")!;
  const otherShell = other.querySelector("section")!;
  const hiddenNodes = [body, form, input];
  let flight: { animation: { cancel(): void }; height: number; done: boolean } | null = null;
  const motions: { keyframes: { height?: string }[]; options: { duration?: number; easing?: string; fill?: string }; animation: { onfinish: (() => void) | null; oncancel: (() => void) | null; cancelled: boolean; finish(): void } }[] = [];
  const otherMotions: unknown[] = [];
  const box = (height: number) => ({ x: 0, y: 0, top: 0, left: 0, right: 420, bottom: height, width: 420, height, toJSON() { return {}; } });
  shell.getBoundingClientRect = () => {
    const height = flight && !flight.done ? flight.height : shell.hasAttribute("data-expanded") ? 320 : resolvedStyle(body).display === "none" ? 48 : 320;
    return box(height);
  };
  shell.animate = (keyframes: { height?: string }[], options: { duration?: number; easing?: string; fill?: string }) => {
    const animation = {
      onfinish: null as (() => void) | null,
      oncancel: null as (() => void) | null,
      cancelled: false,
      cancel() {
        if (this.cancelled) return;
        this.cancelled = true;
        if (flight?.animation === this) flight.done = true;
        this.oncancel?.();
      },
      finish() {
        if (flight?.animation === this) flight.done = true;
        this.onfinish?.();
      },
    };
    motions.push({ keyframes, options, animation });
    flight = { animation, height: Number.parseFloat(keyframes[0]?.height ?? "0"), done: false };
    return animation;
  };
  otherShell.animate = () => {
    otherMotions.push(true);
    return { cancel() {}, onfinish: null, oncancel: null };
  };
  const beforePaint = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  const hideBody = () => {
    shell.removeAttribute("data-expanded");
    body.hidden = true;
    for (const node of hiddenNodes) node.style.setProperty("display", "none", "important");
  };
  const showBody = () => {
    shell.setAttribute("data-expanded", "");
    body.hidden = false;
    for (const node of hiddenNodes) node.style.removeProperty("display");
  };
  let submits = 0;
  let headerClicks = 0;
  form.addEventListener("submit", event => { event.preventDefault(); submits++; });
  shell.querySelector("button")!.addEventListener("click", () => headerClicks++);
  const stop = injectComposerInfo(f.document);
  try {
    await beforePaint();
    assert.equal(motions.length, 0, "the first paint records the open card and does not replay a height animation");
    assert.match(resolvedStyle(banner).animation, /bb-info-enter 260ms/);
    assert.equal(resolvedStyle(shell).animationName, "none");
    assert.equal(resolvedStyle(shell).overflow, "hidden");
    assert.equal(resolvedStyle(shell).borderRadius, "18px");
    assert.equal(resolvedStyle(shell.firstElementChild!).borderBottomColor, "rgba(0, 0, 0, 0)");
    assert.equal(resolvedStyle(shell.querySelector(".sticky")!).backgroundColor, "rgba(0, 0, 0, 0)");
    const hideButton = shell.querySelector<HTMLButtonElement>('[aria-label="Hide details"]')!;
    hideButton.focus();
    hideBody();
    await beforePaint();
    assert.equal(motions.length, 1, "collapse schedules a height animation before the next frame");
    assert.deepEqual(motions[0].keyframes.map(frame => frame.height), ["320px", "48px"]);
    assert.ok((motions[0].options.duration ?? 0) >= 200 && motions[0].options.duration !== 260);
    assert.equal(motions[0].options.fill, "both");
    assert.match(motions[0].options.easing ?? "", /cubic-bezier/);
    assert.equal(body.hidden, false, "the hidden attribute is lifted while the shell height clips the body");
    assert.equal(resolvedStyle(body).display, "block", "the closing body stays painted so the shell can clip it");
    assert.notEqual(resolvedStyle(input).display, "none");
    assert.equal(f.document.activeElement, hideButton);
    assert.equal(input.value, "dummy");
    body.hidden = true;
    body.style.setProperty("display", "none", "important");
    form.style.setProperty("display", "none", "important");
    await beforePaint();
    assert.equal(body.hidden, false, "a re-render does not put the closing body back into hidden");
    assert.equal(resolvedStyle(body).display, "block", "a re-render keeps the closing body painted");
    assert.equal(resolvedStyle(form).display, "block");
    assert.equal(motions.length, 1, "a re-render does not start a second height animation");
    shell.style.maxHeight = "480px";
    await beforePaint();
    assert.equal(shell.style.height, "");
    assert.equal(motions.length, 1);
    motions[0].animation.finish();
    assert.equal(body.hidden, true);
    assert.equal(body.style.display, "none");
    assert.equal(body.style.getPropertyPriority("display"), "important");
    assert.equal(input.style.display, "none");
    assert.equal(resolvedStyle(body).display, "none");
    assert.equal(shell.style.height, "");
    showBody();
    await beforePaint();
    assert.equal(motions.length, 2);
    assert.deepEqual(motions[1].keyframes.map(frame => frame.height), ["48px", "320px"]);
    motions[1].animation.finish();
    shell.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    shell.querySelector("button")!.click();
    assert.equal(submits, 1);
    assert.equal(headerClicks, 1);
    assert.equal(input.value, "dummy");
    hideBody();
    await beforePaint();
    assert.equal(motions.length, 3);
    flight!.height = 180;
    const interrupted = motions[2].animation;
    showBody();
    await beforePaint();
    assert.equal(motions.length, 4, "a reverse toggle replaces the in-flight animation");
    assert.deepEqual(motions[3].keyframes.map(frame => frame.height), ["180px", "320px"]);
    interrupted.onfinish?.();
    assert.equal(shell.hasAttribute("data-expanded"), true);
    assert.notEqual(resolvedStyle(body).display, "none", "the interrupted close does not hide the reopened body");
    motions[3].animation.finish();
    otherShell.removeAttribute("data-expanded");
    await beforePaint();
    assert.equal(otherMotions.length, 0, "question and other request shells keep their own motion");
    assert.equal(motions.length, 4);
    reduce = true;
    hideBody();
    await beforePaint();
    assert.equal(motions.length, 4, "reduced motion keeps the native snap");
    assert.equal(body.style.display, "none");
    assert.equal(body.style.getPropertyPriority("display"), "important");
    assert.equal(resolvedStyle(body).display, "none");
    reduce = false;
    showBody();
    await beforePaint();
    assert.deepEqual(motions.at(-1)?.keyframes.map(frame => frame.height), ["48px", "320px"]);
    motions.at(-1)!.animation.finish();
    hideBody();
    await beforePaint();
    const removed = motions.at(-1)!.animation;
    assert.equal(resolvedStyle(body).display, "block");
    shell.remove();
    await beforePaint();
    assert.equal(removed.cancelled, true, "removing the card cancels its height animation");
    banner.append(shell);
    await beforePaint();
    assert.equal(resolvedStyle(body).display, "none", "a removed card comes back collapsed");
    showBody();
    await beforePaint();
    motions.at(-1)!.animation.finish();
    hideBody();
    await beforePaint();
    const unloading = motions.at(-1)!;
    assert.equal(resolvedStyle(body).display, "block");
    stop();
    assert.equal(unloading.animation.cancelled, true);
    assert.equal(body.style.display, "none");
    assert.equal(body.style.getPropertyPriority("display"), "important");
    assert.equal(resolvedStyle(body).display, "none");
    assert.equal([...shell.attributes].some(attr => attr.name.includes("secret")), false);
    assert.equal(input.value, "dummy");
    assert.equal(resolvedStyle(otherShell.firstElementChild!).borderBottomColor, "rgb(222, 222, 222)");
  } finally { stop(); f.dom.window.close(); }
});

test("plan and approval cards ease height from the current box and keep independent hides", async () => {
  const f = fixture();
  let reduce = false;
  Object.defineProperty(f.dom.window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: query.includes("prefers-reduced-motion") && reduce }),
  });
  const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
  const plan = f.document.createElement("section");
  plan.setAttribute("data-testid", "plan-review-banner");
  plan.setAttribute("data-expanded", "");
  plan.style.maxHeight = "160px";
  plan.innerHTML = '<button type="button" aria-controls="plan-body" aria-label="Plan review">Plan review</button><button type="button" aria-label="Hide details">Hide</button><div id="plan-body"><div data-testid="plan-review-request"><div class="overflow-auto">Long plan</div></div><button type="button" data-approve>Approve</button><input value="keep"><button type="button" data-independent>Hidden</button></div>';
  const approval = f.document.createElement("section");
  approval.setAttribute("data-testid", "approval-banner");
  approval.setAttribute("data-expanded", "");
  approval.style.maxHeight = "400px";
  approval.innerHTML = '<button type="button" aria-controls="approval-body" aria-label="Approval needed">Approval needed</button><button type="button" aria-label="Show details">Show</button><div id="approval-body"><div data-testid="command-preview"><pre class="overflow-auto">$ echo</pre></div><button type="button" data-deny>Deny</button><span data-independent>Hidden</span></div>';
  const question = f.document.createElement("section");
  question.setAttribute("data-testid", "user-question-banner");
  question.setAttribute("data-expanded", "");
  question.innerHTML = '<button type="button" aria-controls="question-body">Question</button><div id="question-body">Ask</div>';
  stack.prepend(question, approval, plan);
  const planBody = plan.querySelector<HTMLElement>("#plan-body")!;
  const approvalBody = approval.querySelector<HTMLElement>("#approval-body")!;
  const questionBody = question.querySelector<HTMLElement>("#question-body")!;
  const planPrivate = plan.querySelector<HTMLElement>("[data-independent]")!;
  const approvalPrivate = approval.querySelector<HTMLElement>("[data-independent]")!;
  for (const node of [planPrivate, approvalPrivate]) {
    node.hidden = true;
    node.style.setProperty("display", "none", "important");
  }
  const planScroller = plan.querySelector<HTMLElement>(".overflow-auto")!;
  const painted = (body: HTMLElement) => resolvedStyle(body).display !== "none";
  const rect = (x: number, y: number, width: number, height: number) => new f.dom.window.DOMRect(x, y, width, height);
  stack.getBoundingClientRect = () => rect(0, 40, 400, 800);
  // The banner box clips the fade. Keep the scroller inside that box.
  planScroller.getBoundingClientRect = () => painted(planBody) ? rect(24, 8, 320, 120) : rect(24, 220, 320, 0);
  Object.defineProperty(planScroller, "scrollTop", { configurable: true, writable: true, value: 0 });
  Object.defineProperty(planScroller, "clientHeight", { configurable: true, get: () => painted(planBody) ? 288 : 0 });
  Object.defineProperty(planScroller, "scrollHeight", { configurable: true, get: () => painted(planBody) ? 600 : 0 });
  Object.defineProperty(plan, "scrollHeight", { configurable: true, value: 320 });
  Object.defineProperty(approval, "scrollHeight", { configurable: true, value: 90 });
  const box = (height: number) => ({ x: 0, y: 0, top: 0, left: 0, right: 420, bottom: height, width: 420, height, toJSON() { return {}; } });
  const flights = new WeakMap<HTMLElement, { animation: { cancel(): void }; height: number; done: boolean }>();
  const used = (shell: HTMLElement, body: HTMLElement, content: number) => {
    const flight = flights.get(shell);
    if (flight && !flight.done) return flight.height;
    const cap = Number.parseFloat(shell.style.maxHeight);
    const open = Number.isFinite(cap) ? Math.min(content, cap) : content;
    if (shell.hasAttribute("data-expanded") && painted(body)) return open;
    if (!shell.hasAttribute("data-expanded") && !painted(body)) return 48;
    return open;
  };
  type Motion = { keyframes: { height?: string }[]; options: { duration?: number; easing?: string; fill?: string }; animation: { onfinish: (() => void) | null; oncancel: (() => void) | null; cancelled: boolean; finish(): void } };
  const mockHeight = (shell: HTMLElement, body: HTMLElement, content: number, bucket: Motion[]) => {
    shell.getBoundingClientRect = () => box(used(shell, body, content));
    shell.animate = ((keyframes: { height?: string }[], options: Motion["options"]) => {
      const animation = {
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
        cancelled: false,
        cancel() {
          if (this.cancelled) return;
          this.cancelled = true;
          const flight = flights.get(shell);
          if (flight?.animation === this) flight.done = true;
          this.oncancel?.();
        },
        finish() {
          const flight = flights.get(shell);
          if (flight?.animation === this) flight.done = true;
          this.onfinish?.();
        },
      };
      bucket.push({ keyframes, options, animation });
      flights.set(shell, { animation, height: Number.parseFloat(keyframes[0]?.height ?? "0"), done: false });
      return animation;
    }) as typeof shell.animate;
  };
  const planMotions: Motion[] = [];
  const approvalMotions: Motion[] = [];
  let questionMotions = 0;
  mockHeight(plan, planBody, 320, planMotions);
  mockHeight(approval, approvalBody, 90, approvalMotions);
  question.animate = () => {
    questionMotions += 1;
    return { cancel() {}, onfinish: null, oncancel: null } as unknown as Animation;
  };
  const beforePaint = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
  const hide = (shell: HTMLElement, body: HTMLElement) => {
    shell.removeAttribute("data-expanded");
    body.hidden = true;
    body.style.setProperty("display", "none", "important");
  };
  const show = (shell: HTMLElement, body: HTMLElement) => {
    shell.setAttribute("data-expanded", "");
    body.hidden = false;
    body.style.removeProperty("display");
  };
  const hiddenStill = (node: HTMLElement) => {
    assert.equal(node.hidden, true);
    assert.equal(node.style.display, "none");
    assert.equal(node.style.getPropertyPriority("display"), "important");
    assert.equal(resolvedStyle(node).display, "none");
  };
  const planFade = (edge: string) => [...f.document.querySelectorAll<HTMLElement>(`[data-bb-chat-ui-info-body-fade="${edge}"]`)].find(node => node.style.left === "24px");
  const endHeight = (motion: Motion) => Number.parseFloat(motion.keyframes.at(-1)?.height ?? "");
  let decisions = 0;
  plan.querySelector("[data-approve]")!.addEventListener("click", () => decisions++);
  approval.querySelector("[data-deny]")!.addEventListener("click", () => decisions++);
  const stop = injectComposerInfo(f.document);
  try {
    await beforePaint();
    assert.equal(planMotions.length, 0, "the first paint records the open card and does not replay a height animation");
    assert.equal(approvalMotions.length, 0);
    assert.equal(resolvedStyle(plan).borderRadius, "18px");
    assert.equal(resolvedStyle(plan).overflow, "hidden");
    assert.equal(resolvedStyle(plan).animationName, "none");
    assert.equal(resolvedStyle(plan).backdropFilter, "blur(14px) saturate(1.25)");
    assert.equal(planFade("below")?.hidden, false, "a settled long body shows the remaining scroll fade");
    assert.equal(plan.contains(planFade("below")!), false);
    hiddenStill(planPrivate);
    hide(question, questionBody);
    await beforePaint();
    assert.equal(questionMotions, 0, "question cards keep their own motion");
    assert.equal(resolvedStyle(questionBody).display, "none");
    hide(plan, planBody);
    await beforePaint();
    assert.equal(planMotions.length, 1, "collapse schedules a height animation before the next frame");
    assert.deepEqual(planMotions[0].keyframes.map(frame => frame.height), ["160px", "48px"]);
    assert.equal(planMotions[0].options.duration, 320);
    assert.equal(planMotions[0].options.easing, "cubic-bezier(.22,1,.36,1)");
    assert.equal(planMotions[0].options.fill, "both");
    assert.equal(planBody.hidden, false, "the disclosure stays painted while the shell height clips it");
    assert.notEqual(resolvedStyle(planBody).display, "none");
    assert.equal(plan.style.height, "");
    assert.equal(plan.style.maxHeight, "160px");
    hiddenStill(planPrivate);
    assert.equal(plan.querySelector("[data-approve]")!.parentElement, planBody);
    assert.equal(planScroller.clientHeight, 288);
    assert.equal(planFade("below")?.hidden, true, "the stack fade hides while the shell height is moving");
    assert.equal(resolvedStyle(planFade("below")!).display, "none");
    planBody.hidden = true;
    planBody.style.setProperty("display", "none", "important");
    await beforePaint();
    assert.equal(planBody.hidden, false, "a re-render keeps the closing disclosure painted");
    assert.notEqual(resolvedStyle(planBody).display, "none");
    hiddenStill(planPrivate);
    assert.equal(planMotions.length, 1, "a re-render does not start a second height animation");
    flights.get(plan)!.height = 100;
    assert.equal(plan.getBoundingClientRect().height, 100, "a mid frame uses the in-flight height");
    const interrupted = planMotions[0].animation;
    show(plan, planBody);
    await beforePaint();
    assert.equal(planMotions.length, 2, "a reverse toggle replaces the in-flight animation");
    assert.deepEqual(planMotions[1].keyframes.map(frame => frame.height), ["100px", "160px"]);
    interrupted.onfinish?.();
    assert.notEqual(resolvedStyle(planBody).display, "none", "the interrupted close does not hide the reopened body");
    hiddenStill(planPrivate);
    assert.equal(planFade("below")?.hidden, true, "the fade stays hidden through the reverse");
    planMotions[1].animation.finish();
    assert.equal(plan.getBoundingClientRect().height, endHeight(planMotions[1]), "cancelling the fill does not jump past the capped box");
    assert.equal(plan.getBoundingClientRect().height, 160);
    assert.notEqual(plan.getBoundingClientRect().height, 320);
    assert.equal(plan.style.height, "");
    assert.equal(plan.style.maxHeight, "160px");
    assert.equal(planFade("below")?.hidden, false, "the fade returns from the settled scroll edges");
    (plan.querySelector("[data-approve]") as HTMLButtonElement).click();
    assert.equal((plan.querySelector("input") as HTMLInputElement).value, "keep");
    hide(plan, planBody);
    await beforePaint();
    assert.deepEqual(planMotions.at(-1)?.keyframes.map(frame => frame.height), ["160px", "48px"]);
    planMotions.at(-1)!.animation.finish();
    assert.equal(plan.getBoundingClientRect().height, 48);
    assert.equal(endHeight(planMotions.at(-1)!), 48);
    assert.equal(plan.style.height, "");
    assert.equal(planBody.hidden, true);
    assert.equal(planBody.style.display, "none");
    assert.equal(planBody.style.getPropertyPriority("display"), "important");
    assert.equal(resolvedStyle(planBody).display, "none");
    assert.equal(planScroller.clientHeight, 0);
    assert.equal(planFade("below")?.hidden, true, "the collapsed body recalculates the fade instead of leaving it forced");
    hiddenStill(planPrivate);
    hide(approval, approvalBody);
    await beforePaint();
    assert.equal(approvalMotions.length, 1);
    assert.deepEqual(approvalMotions[0].keyframes.map(frame => frame.height), ["90px", "48px"]);
    hiddenStill(approvalPrivate);
    assert.equal(approval.querySelector("[data-deny]")!.parentElement, approvalBody);
    approvalMotions[0].animation.finish();
    assert.equal(approval.getBoundingClientRect().height, 48);
    assert.equal(approval.style.height, "");
    assert.equal(resolvedStyle(approvalBody).display, "none");
    show(approval, approvalBody);
    await beforePaint();
    assert.deepEqual(approvalMotions.at(-1)?.keyframes.map(frame => frame.height), ["48px", "90px"]);
    approvalMotions.at(-1)!.animation.finish();
    assert.equal(approval.getBoundingClientRect().height, 90);
    assert.equal(approval.style.maxHeight, "400px");
    hiddenStill(approvalPrivate);
    (approval.querySelector("[data-deny]") as HTMLButtonElement).click();
    assert.equal(decisions, 2);
    reduce = true;
    hide(plan, planBody);
    await beforePaint();
    assert.equal(planMotions.length, 3, "reduced motion keeps the native snap");
    assert.equal(resolvedStyle(planBody).display, "none");
    assert.equal(planBody.style.getPropertyPriority("display"), "important");
    reduce = false;
    show(plan, planBody);
    await beforePaint();
    assert.deepEqual(planMotions.at(-1)?.keyframes.map(frame => frame.height), ["48px", "160px"]);
    planMotions.at(-1)!.animation.finish();
    hide(plan, planBody);
    await beforePaint();
    const removed = planMotions.at(-1)!.animation;
    assert.notEqual(resolvedStyle(planBody).display, "none");
    plan.remove();
    await beforePaint();
    assert.equal(removed.cancelled, true, "removing the card cancels its height animation");
    stack.prepend(plan);
    await beforePaint();
    assert.equal(resolvedStyle(planBody).display, "none", "a removed card comes back collapsed");
    hiddenStill(planPrivate);
    show(plan, planBody);
    await beforePaint();
    planMotions.at(-1)!.animation.finish();
    hide(plan, planBody);
    await beforePaint();
    const unloading = planMotions.at(-1)!;
    assert.notEqual(resolvedStyle(planBody).display, "none");
    stop();
    assert.equal(unloading.animation.cancelled, true);
    assert.equal(planBody.style.display, "none");
    assert.equal(planBody.style.getPropertyPriority("display"), "important");
    assert.equal(resolvedStyle(planBody).display, "none");
    assert.equal([...plan.attributes].some(attr => attr.name.includes("secret")), false);
    assert.equal([...approval.attributes].some(attr => attr.name.includes("secret")), false);
    assert.equal(questionMotions, 0);
    assert.equal((plan.querySelector("input") as HTMLInputElement).value, "keep");
  } finally { stop(); f.dom.window.close(); }
});

test("plan review body sits in the card and fades only the scroll directions that remain", async () => {
  assert.deepEqual(scrollOverflowEdges({ scrollTop: 0, clientHeight: 288, scrollHeight: 200 }), { above: false, below: false });
  assert.deepEqual(scrollOverflowEdges({ scrollTop: 0, clientHeight: 288, scrollHeight: 600 }), { above: false, below: true });
  assert.deepEqual(scrollOverflowEdges({ scrollTop: 100, clientHeight: 288, scrollHeight: 600 }), { above: true, below: true });
  assert.deepEqual(scrollOverflowEdges({ scrollTop: 312, clientHeight: 288, scrollHeight: 600 }), { above: true, below: false });

  const f = fixture();
  const native = f.document.createElement("style");
  native.textContent = ".border { border: 1px solid #ccc; } .bg-card { background-color: white; } .rounded-lg { border-radius: 8px; } .px-3 { padding-left: 12px; padding-right: 12px; } .border-t { border-top: 1px solid #ccc; }";
  f.document.head.append(native);
  const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
  const card = f.document.createElement("section");
  card.setAttribute("data-testid", "plan-review-banner");
  card.setAttribute("data-expanded", "");
  card.innerHTML = '<div class="mt-2"><div data-testid="plan-review-request" class="overflow-hidden rounded-lg border bg-card"><div class="overflow-auto px-3 py-2">Plan body</div><p class="border-t px-3">docs/plan.md</p></div></div>';
  stack.prepend(card);
  const body = card.querySelector('[data-testid="plan-review-request"]')!;
  const scroller = body.querySelector(".overflow-auto")!;
  const path = body.querySelector("p")!;
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick();
    const box = resolvedStyle(body);
    const scroll = resolvedStyle(scroller);
    assert.equal(box.backgroundColor, "rgba(0, 0, 0, 0)");
    assert.equal(box.borderTopWidth, "0px");
    assert.equal(box.borderRadius, "0px");
    assert.equal(box.backdropFilter, "none", "the plan body does not add a second glass layer");
    assert.equal(resolvedStyle(card).backdropFilter, "blur(14px) saturate(1.25)");
    assert.equal(scroll.paddingLeft, "0px");
    assert.equal(scroll.paddingRight, "0px");
    assert.equal(resolvedStyle(path).borderTopWidth, "0px");
    const approval = f.document.createElement("section");
    approval.setAttribute("data-testid", "approval-banner");
    approval.innerHTML = '<div class="overflow-y-auto" data-shell-scroll><h3>Do you want to run this command?</h3><div data-testid="command-preview" class="overflow-hidden"><pre class="overflow-auto px-3 py-2">$ echo</pre><button type="button">Show more</button></div></div>';
    const shellScroll = approval.querySelector<HTMLElement>("[data-shell-scroll]")!;
    const approvalScroller = approval.querySelector<HTMLElement>("pre")!;
    const secret = f.document.createElement("section");
    secret.innerHTML = '<section data-testid="plugin-interaction-shell" data-expanded><div class="overflow-auto" data-secret-scroll><form class="@container/secrets">secret</form></div></section>';
    const secretScroller = secret.querySelector<HTMLElement>("[data-secret-scroll]")!;
    stack.prepend(secret);
    stack.prepend(approval);
    const short = f.document.createElement("div");
    short.className = "overflow-auto";
    short.textContent = "Short plan.";
    const shortRequest = f.document.createElement("div");
    shortRequest.setAttribute("data-testid", "plan-review-request");
    shortRequest.append(short);
    card.append(shortRequest);
    const rect = (x: number, y: number, width: number, height: number) => new f.dom.window.DOMRect(x, y, width, height);
    stack.getBoundingClientRect = () => rect(0, 40, 400, 800);
    scroller.getBoundingClientRect = () => rect(24, 180, 320, 288);
    approvalScroller.getBoundingClientRect = () => rect(30, 520, 300, 160);
    shellScroll.getBoundingClientRect = () => rect(10, 80, 360, 500);
    secretScroller.getBoundingClientRect = () => rect(12, 20, 200, 120);
    short.getBoundingClientRect = () => rect(24, 700, 320, 40);
    const metrics = (node: HTMLElement, scrollHeight: number, clientHeight: number) => {
      Object.defineProperty(node, "scrollHeight", { configurable: true, value: scrollHeight });
      Object.defineProperty(node, "clientHeight", { configurable: true, value: clientHeight });
    };
    metrics(scroller, 600, 288);
    metrics(approvalScroller, 400, 160);
    metrics(shellScroll, 900, 500);
    metrics(secretScroller, 400, 120);
    metrics(short, 40, 40);
    const fades = () => [...f.document.querySelectorAll<HTMLElement>("[data-bb-chat-ui-info-body-fade]")];
    const visible = (edge: string) => fades().filter(node => node.getAttribute("data-bb-chat-ui-info-body-fade") === edge && !node.hidden);
    const at = (edge: string, top: number, left: number, width: number, height = 24) => visible(edge).find(node =>
      node.style.top === `${top}px` && node.style.left === `${left}px` && node.style.width === `${width}px` && node.style.height === `${height}px`);
    const move = (node: HTMLElement, top: number) => {
      node.scrollTop = top;
      node.dispatchEvent(new f.dom.window.Event("scroll", { bubbles: true }));
    };
    move(scroller, 0);
    move(approvalScroller, 0);
    move(shellScroll, 0);
    move(secretScroller, 0);
    move(short, 0);
    assert.ok(at("below", 404, 24, 320), "plan bottom fade uses the scroller viewport, not its padding or the path");
    assert.equal(at("above", 140, 24, 320), undefined);
    assert.ok(at("below", 616, 30, 300), "approval command fade uses the pre viewport");
    assert.equal(at("above", 480, 30, 300), undefined);
    assert.equal(visible("below").length, 2);
    for (const fade of visible("below")) assert.notEqual(resolvedStyle(fade).display, "none", "request overlays remain outside the pending-card guard");
    assert.equal(visible("above").length, 0);
    assert.equal(at("below", 404, 24, 320)!.parentElement, stack);
    assert.equal(scroller.contains(at("below", 404, 24, 320)!), false);
    assert.equal(resolvedStyle(at("below", 404, 24, 320)!).backdropFilter, "blur(5px)");
    move(scroller, 100);
    assert.ok(at("above", 140, 24, 320));
    assert.ok(at("below", 404, 24, 320));
    move(scroller, 312);
    assert.ok(at("above", 140, 24, 320));
    assert.equal(at("below", 404, 24, 320), undefined);
    move(approvalScroller, 240);
    assert.ok(at("above", 480, 30, 300));
    assert.equal(at("below", 616, 30, 300), undefined);
    metrics(approvalScroller, 160, 160);
    move(approvalScroller, 0);
    assert.equal(at("above", 480, 30, 300), undefined);
    assert.equal(at("below", 616, 30, 300), undefined);
    assert.equal(visible("above").some(node => node.style.top === "40px" || node.style.top === "660px"), false, "the shell scroller and a short plan do not draw a fade");
    assert.equal(fades().some(node => secretScroller.contains(node) || shellScroll.contains(node)), false);
    assert.equal(scroller.parentElement, body);
    assert.equal(approvalScroller.parentElement, approval.querySelector("[data-testid='command-preview']"));
    stop();
    assert.equal(f.document.querySelector("[data-bb-chat-ui-info-body-fade]"), null);
  } finally { stop(); f.dom.window.close(); }
});

function manualFrames(view: Window) {
  const frames: Array<FrameRequestCallback | null> = [];
  view.requestAnimationFrame = callback => {
    frames.push(callback);
    return frames.length;
  };
  view.cancelAnimationFrame = handle => { frames[handle - 1] = null; };
  return {
    async pump(count: number) {
      for (let i = 0; i < count; i += 1) {
        for (let step = 0; step < 8; step += 1) await Promise.resolve();
        const batch = frames.splice(0).filter((callback): callback is FrameRequestCallback => callback !== null);
        if (batch.length === 0) break;
        for (const callback of batch) callback(0);
      }
      for (let step = 0; step < 8; step += 1) await Promise.resolve();
    },
  };
}

test("body fade updates do not measure the stack when no Plan or Approval body exists", async () => {
  const f=fixture(),stack=f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  let reads=0;
  stack.getBoundingClientRect=()=>{reads++;return {top:0,left:0,width:900} as DOMRect;};
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();await f.tick();reads=0;
    stack.dispatchEvent(new f.dom.window.Event('animationend',{bubbles:true}));
    stack.dispatchEvent(new f.dom.window.Event('animationcancel',{bubbles:true}));
    stack.dispatchEvent(new f.dom.window.Event('scroll'));
    assert.equal(reads,0,'scroll and animation notifications have no body-fade geometry to read');
  } finally {stop();f.dom.window.close();}
});

test("a stationary plan card does not reinsert body fades", async () => {
  const f = fixture();
  const stack = f.document.querySelector("[data-promptbox-shell] > .grid")!;
  const card = f.document.createElement("section");
  card.setAttribute("data-testid", "plan-review-banner");
  card.innerHTML = '<div data-testid="plan-review-request"><div class="overflow-auto">Plan body</div></div>';
  stack.prepend(card);
  const frames = manualFrames(f.dom.window);
  let inserted = 0;
  const watcher = new f.dom.window.MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node instanceof f.dom.window.Element && node.hasAttribute("data-bb-chat-ui-info-body-fade")) inserted += 1;
    }
  });
  watcher.observe(f.document.body, { childList: true, subtree: true });
  const stop = injectComposerInfo(f.document);
  try {
    await frames.pump(8);
    const hints = [...f.document.querySelectorAll<HTMLElement>("[data-bb-chat-ui-info-body-fade]")];
    assert.equal(hints.length, 2);
    const settled = inserted;
    await frames.pump(4);
    assert.equal(inserted, settled, "idle frames do not add body fades again");
    const moved = hints[0];
    f.document.body.append(moved);
    await frames.pump(2);
    assert.equal(moved.parentElement, stack, "a hint with a different parent is attached again");
    const reattached = inserted;
    await frames.pump(4);
    assert.equal(inserted, reattached, "reattaching once does not resume the idle loop");
  } finally { watcher.disconnect(); stop(); f.dom.window.close(); }
});

test("a request card keeps measuring body fades after the popover observer resets", async () => {
  const f = fixture();
  class RecordingResizeObserver {
    static instances: RecordingResizeObserver[] = [];
    targets = new Set<Element>();
    callback: () => void;
    constructor(callback: () => void) {
      this.callback = callback;
      RecordingResizeObserver.instances.push(this);
    }
    observe(target: Element) { this.targets.add(target); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  }
  f.dom.window.ResizeObserver = RecordingResizeObserver as unknown as typeof ResizeObserver;
  const frames = manualFrames(f.dom.window);
  const stop = injectComposerInfo(f.document);
  try {
    f.click("[data-bb-chat-ui-info-all]");
    const stack = f.document.querySelector<HTMLElement>("[data-promptbox-shell] > .grid")!;
    const card = f.document.createElement("section");
    card.setAttribute("data-testid", "plan-review-banner");
    card.innerHTML = '<div data-testid="plan-review-request"><div class="overflow-auto">Plan body</div></div>';
    let height = 288;
    const scroller = card.querySelector<HTMLElement>(".overflow-auto")!;
    const rect = (x: number, y: number, width: number, boxHeight: number) => new f.dom.window.DOMRect(x, y, width, boxHeight);
    stack.getBoundingClientRect = () => rect(0, 40, 400, 800);
    scroller.getBoundingClientRect = () => rect(24, 180, 320, height);
    stack.prepend(card);
    await frames.pump(4);
    const below = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-body-fade="below"]')!;
    assert.equal(below.style.top, "404px");
    assert.equal(below.style.height, "24px");
    const observed = RecordingResizeObserver.instances.some(observer => observer.targets.has(scroller));
    assert.equal(observed, true, "the body scroller stays observed after the menu observer disconnects");
    height = 80;
    for (const observer of RecordingResizeObserver.instances) if (observer.targets.has(scroller)) observer.callback();
    assert.equal(below.style.height, "20px");
    assert.equal(below.style.top, "200px", "a body viewport resize moves the fade");
  } finally { stop(); f.dom.window.close(); }
});

test("a clipped plan body keeps the scroll blur on the visible edge", async () => {
  const f = fixture();
  class RecordingResizeObserver {
    static instances: RecordingResizeObserver[] = [];
    targets = new Set<Element>();
    callback: () => void;
    constructor(callback: () => void) {
      this.callback = callback;
      RecordingResizeObserver.instances.push(this);
    }
    observe(target: Element) { this.targets.add(target); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  }
  f.dom.window.ResizeObserver = RecordingResizeObserver as unknown as typeof ResizeObserver;
  f.document.body.insertAdjacentHTML("beforeend", '<span hidden data-bb-chat-ui-device="phone" data-bb-chat-ui-orientation="portrait" data-bb-chat-ui-viewport="narrow" data-bb-chat-ui-hit-target="large"></span>');
  const stack = f.document.querySelector<HTMLElement>("[data-promptbox-shell] > .grid")!;
  const card = f.document.createElement("section");
  card.setAttribute("data-testid", "plan-review-banner");
  card.setAttribute("data-expanded", "");
  card.style.border = "1px solid transparent";
  card.innerHTML = '<div data-body-clip style="overflow-y:auto;overflow-x:visible"><div data-testid="plan-review-request"><div class="overflow-auto">Plan body</div></div></div>';
  stack.prepend(card);
  const body = card.querySelector<HTMLElement>("[data-body-clip]")!;
  const scroller = card.querySelector<HTMLElement>(".overflow-auto")!;
  const rect = (x: number, y: number, width: number, height: number) => new f.dom.window.DOMRect(x, y, width, height);
  let cardHeight = 160;
  let bodyTop = 90;
  let scrollerTop = 100;
  let scrollerHeight = 304;
  stack.getBoundingClientRect = () => rect(0, 0, 400, 800);
  card.getBoundingClientRect = () => rect(10, 80, 300, cardHeight);
  body.getBoundingClientRect = () => rect(16, bodyTop, 340, 400);
  scroller.getBoundingClientRect = () => rect(24, scrollerTop, 320, scrollerHeight);
  Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 304 });
  Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 688 });
  const stop = injectComposerInfo(f.document);
  try {
    const below = () => f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-body-fade="below"]')!;
    const above = () => f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-body-fade="above"]')!;
    const move = (top: number) => {
      scroller.scrollTop = top;
      scroller.dispatchEvent(new f.dom.window.Event("scroll", { bubbles: true }));
    };
    move(0);
    assert.equal(below().hidden, false);
    assert.equal(below().style.top, "215px", "the bottom blur sits on the card padding edge, not the scroller's unclipped bottom");
    assert.equal(below().style.left, "24px");
    assert.equal(below().style.width, "285px", "the blur stops at the card's clipped right edge");
    assert.equal(below().style.height, "24px");
    assert.equal(above().hidden, true);
    assert.equal(below().parentElement, stack);
    assert.equal(resolvedStyle(below()).backdropFilter, "blur(5px)");
    assert.match(resolvedStyle(below()).maskImage, /linear-gradient/);
    move(100);
    assert.equal(above().hidden, false);
    assert.equal(above().style.top, "100px");
    assert.equal(above().style.height, "24px");
    assert.equal(below().style.top, "215px");
    move(384);
    assert.equal(below().hidden, false, "a clipped bottom stays blurred after the inner scroller reaches its end");
    assert.equal(below().style.top, "215px");
    assert.equal(above().hidden, false);
    assert.equal(above().style.top, "100px");
    scrollerTop = 40;
    move(0);
    assert.equal(above().hidden, false, "content clipped above the visible edge gets a top blur before the inner scroller moves");
    assert.equal(above().style.top, "90px");
    assert.equal(above().style.width, "285px");
    assert.equal(below().style.top, "215px");
    bodyTop = 130;
    move(0);
    assert.equal(above().style.top, "130px", "a taller header moves the visible top, and the blur follows that edge");
    assert.equal(above().style.height, "24px");
    scrollerTop = 100;
    bodyTop = 90;
    cardHeight = 140;
    move(0);
    f.click("[data-bb-chat-ui-info-all]");
    await f.tick();
    const watching = RecordingResizeObserver.instances.some(observer => observer.targets.has(card) && observer.targets.has(body));
    assert.equal(watching, true, "the clipping card and body stay observed after the popover observer resets");
    for (const observer of RecordingResizeObserver.instances) if (observer.targets.has(card)) observer.callback();
    assert.equal(below().style.top, "195px", "a card resize moves the blur to the new visible bottom");
    assert.equal(below().style.height, "24px");
  } finally { stop(); f.dom.window.close(); }
});

test("two plugin notices are separately reachable, and unloading keeps a queue edit open", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const second = f.document.createElement("section");
  second.setAttribute("aria-label", "Second plugin notice");
  second.innerHTML = '<button>Act on second notice</button>';
  stack.append(second);
  const stop = injectComposerInfo(f.document);
  f.click('[aria-label^="전체 정보"]');
  const choices = f.document.querySelectorAll<HTMLButtonElement>('[data-bb-chat-ui-info-choice="other"]');
  assert.equal(choices.length, 2);
  choices[1].click();
  assert.ok(second.hasAttribute("data-bb-chat-ui-info-open"));
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="queue"]');
  const queue = f.document.querySelector('section[aria-label="Queued messages"]')!;
  queue.insertAdjacentHTML("beforeend", '<textarea data-queued-message-inline-editor>draft edit</textarea>');
  stop();
  assert.equal(queue.querySelector('[aria-expanded]')!.getAttribute('aria-expanded'), 'true');
  assert.equal(queue.querySelector('textarea')!.value, 'draft edit');
  f.dom.window.close();
});

test("queue editing blocks detail replacement and dismissal until editing finishes", async () => {
  const f = fixture();
  const stop = injectComposerInfo(f.document);
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="queue"]');
  await f.tick();
  const queue = f.document.querySelector('section[aria-label="Queued messages"]')!;
  const editor = f.document.createElement("textarea");
  editor.setAttribute("data-queued-message-inline-editor", "");
  editor.value = "unsaved edit";
  queue.append(editor);
  f.click('[data-bb-chat-ui-info-trigger="children"]');
  f.document.dispatchEvent(new f.dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await f.tick();
  assert.ok(queue.hasAttribute("data-bb-chat-ui-info-open"));
  assert.equal(editor.value, "unsaved edit");
  editor.remove();
  f.click('[data-bb-chat-ui-info-trigger="children"]');
  await f.tick();
  assert.equal(queue.hasAttribute("data-bb-chat-ui-info-open"), false);
  stop();
  f.dom.window.close();
});

test("restore action text keeps the compact size when desktop button defaults are larger", () => {
  for (const [label,kind,text] of [['Thread is archived','unarchive','Unarchive'],['Environment unavailable','environment','Restore workspace']]) {
    const f=fixture();
    const style=f.document.createElement('style');
    style.textContent='[data-promptbox-shell] button { font-size:14px; line-height:20px; }';
    f.document.head.append(style);
    f.document.body.insertAdjacentHTML('beforeend','<span hidden data-bb-chat-ui-device="desktop" data-bb-chat-ui-viewport="wide"></span>');
    f.document.querySelector('[data-promptbox-shell] > .grid')!.insertAdjacentHTML('beforeend',`<section aria-label="Thread history"><div role="status" aria-label="${label}">${label}</div></section>`);
    const source=f.document.createElement('button'); source.setAttribute('data-bb-chat-ui-info-restore-source',kind); source.textContent=text;
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.append(source);
    let calls=0; source.addEventListener('click',()=>calls++);
    const stop=injectComposerInfo(f.document);
    try {
      f.click('[data-bb-chat-ui-info-trigger="status"]');
      const action=f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-unarchive]')!;
      const css=resolvedStyle(action);
      assert.equal(css.fontSize,'12px',`${text}: desktop button defaults do not enlarge the shared text action`);
      assert.equal(css.lineHeight,'14px','compact text keeps its matching line height');
      assert.equal(css.minHeight,"24px",'a pointer uses the shared 28px text action');
      f.document.documentElement.setAttribute('data-bb-chat-ui-root-hit-target','large');
      assert.equal(resolvedStyle(action).minHeight,"24px",'a finger keeps the 32px hit target');
      action.click(); assert.equal(calls,1,'the restore action still reaches its original SDK control');
    } finally { stop(); f.dom.window.close(); }
  }
});

test("archived stack-only composer offers only restore and preserves its native action", async () => {
  const f = fixture();
  f.document.querySelector('[data-follow-up-composer-anchor]')!.remove();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const status = f.document.createElement("section");
  status.setAttribute("aria-label", "Thread archived");
  status.innerHTML = '<p>Parent thread and archived metadata</p><button>Unarchive</button>';
  stack.append(status);
  let restored = 0;
  status.querySelector('button')!.addEventListener('click', () => restored++);
  const stop = injectComposerInfo(f.document);
  assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-all]')!.hidden,true);
  assert.deepEqual([...f.document.querySelectorAll('[data-bb-chat-ui-info-trigger]')].map(node => node.getAttribute('data-bb-chat-ui-info-trigger')),['status']);
  const pill = f.click('[data-bb-chat-ui-info-trigger="status"]');
  assert.equal(pill.textContent,'Archived thread');
  assert.equal(resolvedStyle(pill).width,'100%');
  const popover=f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-archived-detail]')!;
  assert.ok(popover);
  const restoreStyle=resolvedStyle(popover.querySelector('[data-bb-chat-ui-info-unarchive]')!);
  assert.equal(restoreStyle.width,'100%','the restore button spans the whole content width');
  assert.equal(restoreStyle.display,'flex');
  assert.equal(popover.querySelectorAll('button').length,2,'only close and restore are present');
  assert.equal(popover.textContent?.includes('Parent thread'),false);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-archive-catalog]'),null);
  f.click('[data-bb-chat-ui-info-unarchive]');
  assert.equal(restored, 1);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-open]'),null,'the native context card stays hidden');
  const nativeAction=status.querySelector<HTMLButtonElement>('button')!;
  nativeAction.disabled=true; nativeAction.textContent='Unarchiving...'; await f.tick();
  assert.equal(popover.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-unarchive]')!.disabled,true);
  assert.equal(popover.querySelector('[data-bb-chat-ui-info-unarchive]')!.textContent,'Unarchiving...');
  f.click('[data-bb-chat-ui-info-unarchive]');
  assert.equal(restored,1,'the pending state prevents another restore');
  status.remove(); await f.tick();
  assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-all]')!.hidden,false);
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]'),'unarchiving restores the normal information row');
  stop();
  f.dom.window.close();
});

test("native Thread history shows one full-width state for archive and removed environments", async () => {
  const f=fixture();
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const status=f.document.createElement('section'); status.setAttribute('aria-label','Thread history');
  status.innerHTML='<div role="status" aria-label="Thread is archived">Thread is archived</div><button>Unarchive</button>';
  stack.append(status);
  const stop=injectComposerInfo(f.document);
  try {
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="status"]')?.textContent,'Archived thread');
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'),null);
    status.innerHTML='<div role="status" aria-label="Workspace removed">Workspace removed</div><button>Restore workspace</button>';
    await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'),null);
    assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-all]')!.hidden,true);
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="status"]')?.textContent,'Workspace removed');
  } finally { stop(); f.dom.window.close(); }
});

test("restore popovers use the SDK bridge when BB omits its native action", async () => {
  for (const [label,kind,text] of [['Thread is archived','unarchive','Unarchive'],['Environment unavailable','environment','Restore workspace'],['Machine removed','environment','Restore workspace'],['Machine removal in progress','environment','Restore workspace'],['Machine cleanup failed','environment','Restore workspace']]) {
    const f=fixture();
    const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
    stack.insertAdjacentHTML('beforeend',`<section aria-label="Thread history"><button id="thread-prompt-banner-parent-thread-toggle" aria-expanded="false" aria-controls="omitted-action">Parent</button><div role="status" aria-label="${label}">${label}</div><div id="omitted-action" hidden>Parent details without a restore action</div></section>`);
    const source=f.document.createElement('button'); source.setAttribute('data-bb-chat-ui-info-restore-source',kind); source.textContent=text;
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.append(source);
    let calls=0; source.addEventListener('click',()=>calls++);
    const stop=injectComposerInfo(f.document);
    try {
      f.click('[data-bb-chat-ui-info-trigger="status"]');
      const restore=f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-unarchive]')!;
      assert.equal(restore.disabled,false,'the missing native button must not disable the SDK action');
      assert.equal(restore.textContent,text);
      assert.equal(f.document.querySelector('#thread-prompt-banner-parent-thread-toggle')!.getAttribute('aria-expanded'),'false','SDK restore does not expand the parent card');
      restore.click(); assert.equal(calls,1);
      source.disabled=true; source.textContent='Restoring...'; await f.tick();
      assert.equal(restore.disabled,true);
      source.setAttribute('data-bb-chat-ui-info-restore-error','Provider restore failed'); await f.tick();
      assert.equal(f.document.querySelector('[role="alert"]')?.textContent,'Provider restore failed');
      source.removeAttribute('data-bb-chat-ui-info-restore-error'); source.disabled=false; source.textContent=text; await f.tick();
      assert.equal(f.document.querySelector('[role="alert"]'),null);
      assert.equal(restore.disabled,false);
      assert.equal(f.document.querySelector('[data-bb-chat-ui-info-archive-catalog]'),null);
    } finally { stop(); f.dom.window.close(); }
  }
});

test("SDK restoration capability overrides a stale native action and archive takes priority", async () => {
  const f=fixture();
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML('beforeend','<section aria-label="Thread history"><div role="status" aria-label="Machine removed">Machine removed</div><button>Restore workspace</button></section>');
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.innerHTML='<button data-bb-chat-ui-info-restore-source="environment" disabled>복구 불가</button><button data-bb-chat-ui-info-restore-source="unarchive">Unarchive</button>';
  let calls=0; source.querySelector('[data-bb-chat-ui-info-restore-source="unarchive"]')!.addEventListener('click',()=>calls++);
  const stop=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="status"]');
    const restore=f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-unarchive]')!;
    assert.equal(restore.textContent,'복구 불가'); assert.equal(restore.disabled,true);
    source.setAttribute('data-bb-chat-ui-info-read-only-label','Archived thread'); await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="status"]')!.textContent,'Archived thread');
    f.click('[data-bb-chat-ui-info-trigger="status"]');
    f.click('[aria-label="Unarchive"]'); assert.equal(calls,1);
    source.removeAttribute('data-bb-chat-ui-info-read-only-label');
    stack.querySelector('section[aria-label="Thread history"]')!.remove(); await f.tick();
    assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-all]')!.hidden,false);
  } finally { stop(); f.dom.window.close(); }
});

test("restoring returns to normal pills before the SDK read-only snapshot catches up", async () => {
  for (const showInactiveInfo of [false,true]) for (const [nativeLabel,sdkLabel] of [['Thread is archived','Archived thread'],['Environment unavailable','Environment unavailable']]) {
    const f=fixture();
    const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
    const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
    source.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({showInactiveInfo}));
    source.setAttribute('data-bb-chat-ui-info-read-only-label',sdkLabel);
    source.insertAdjacentHTML('beforeend','<span data-bb-chat-ui-info-icon="status"><svg data-placeholder-icon="status" /></span>');
    const status=f.document.createElement('section'); status.setAttribute('aria-label','Thread history');
    status.innerHTML=`<div role="status" aria-label="${nativeLabel}">${nativeLabel}</div><button>Unarchive</button>`;
    stack.append(status);
    const stop=injectComposerInfo(f.document);
    try {
      const bar=f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!;
      assert.equal(bar.hasAttribute('data-bb-chat-ui-info-archived'),true);
      f.click('[data-bb-chat-ui-info-trigger="status"]');
      status.remove(); await f.tick();
      assert.equal(bar.hasAttribute('data-bb-chat-ui-info-archived'),false,'a delayed SDK snapshot cannot leave a full-width empty status pill after restore');
      assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-all]')!.hidden,!showInactiveInfo);
      assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="goal"]'));
      assert.equal(f.document.querySelector('[data-bb-chat-ui-info-archived-detail]'),null);
      const pill=f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-trigger="status"]');
      assert.equal(pill,null,'restored empty status belongs to the stack or its +N catalog, never a full pill');
      if(showInactiveInfo){
        f.click('[data-bb-chat-ui-info-all]');
        assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="status"]'),'opted-in inactive status remains reachable');
        f.click('[data-bb-chat-ui-info-close]');
      }else assert.equal(f.document.querySelector('[data-bb-chat-ui-info-stack-kind="status"]'),null,'restored empty status is hidden by default');
      source.removeAttribute('data-bb-chat-ui-info-read-only-label'); await f.tick();
      assert.equal(bar.hasAttribute('data-bb-chat-ui-info-archived'),false);
    } finally { stop(); f.dom.window.close(); }
  }
});

test("archived restore uses a lazily mounted parent-context action without exposing parent information", async () => {
  const f=fixture();
  const status=f.document.createElement('section'); status.setAttribute('aria-label','Thread history');
  status.innerHTML='<button id="thread-prompt-banner-parent-thread-toggle" aria-expanded="false" aria-controls="parent-body">Parent thread</button><div role="status" aria-label="Thread is archived">Thread is archived</div><div id="parent-body" hidden></div>';
  let restored=0;
  status.querySelector('button')!.addEventListener('click',()=>{
    const toggle=status.querySelector('button')!;
    const expanded=toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded',String(expanded));
    const body=status.querySelector<HTMLElement>('#parent-body')!; body.hidden=!expanded;
    if (expanded && !body.children.length) {
      body.innerHTML='<p>Private parent details</p><button>Unarchive</button>';
      body.querySelector('button')!.addEventListener('click',()=>restored++);
    }
  });
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(status);
  const stop=injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="status"]'); await f.tick();
    const popup=f.document.querySelector('[data-bb-chat-ui-info-archived-detail]')!;
    assert.equal(popup.textContent?.includes('Private parent details'),false);
    f.click('[data-bb-chat-ui-info-unarchive]'); assert.equal(restored,1);
    f.click('[aria-label="Archived thread 닫기"]');
    assert.equal(status.querySelector('button')!.getAttribute('aria-expanded'),'false','closing restores the hidden native disclosure');
  } finally { stop(); f.dom.window.close(); }
});

test("archived status stays visible on narrow screens and yields to an input request", async () => {
  const f=fixture();
  const stack=f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  stack.getBoundingClientRect=()=>({ width:120 } as DOMRect);
  Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetWidth',{get:()=>120});
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify(Object.fromEntries(infoKinds.map(kind=>[kind.setting,'끄기']))));
  stack.insertAdjacentHTML('beforeend','<section aria-label="Thread archived"><button>Unarchive</button></section>');
  const stop=injectComposerInfo(f.document);
  try {
    assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-trigger="status"]')!.hidden,false,'archive status is a required full-width state, not an overflow pill');
    assert.equal(f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-all]')!.hidden,true);
    const request=f.document.createElement('section'); request.setAttribute('data-testid','user-question-banner'); stack.append(request);
    await f.tick();
    assert.equal(f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!.hidden,true);
    request.remove(); await f.tick();
    assert.equal(f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!.hidden,false);
  } finally { stop(); f.dom.window.close(); }
});

test("read-only supplements remain available without replacing native editable cards", async () => {
  const f = fixture();
  const stack = f.document.querySelector('[data-promptbox-shell] > .grid')!;
  stack.insertAdjacentHTML("beforeend", `<div data-bb-chat-ui-info-supplements>
    <section data-bb-chat-ui-info-kind="goal" aria-label="Goal"><p>Read-only Goal snapshot</p></section>
    <section data-bb-chat-ui-info-kind="plan" aria-label="Plan"><p>Archived plan text</p></section>
  </div>`);
  const stop = injectComposerInfo(f.document);
  f.click('[aria-label^="전체 정보"]');
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice="goal"]').length, 1);
  f.click('[data-bb-chat-ui-info-choice="goal"]');
  assert.ok(f.document.querySelector('section[aria-label="Goal"]:not([data-bb-chat-ui-info-kind])')!.hasAttribute('data-bb-chat-ui-info-open'));
  f.click('[aria-label^="전체 정보"]');
  f.click('[data-bb-chat-ui-info-choice="plan"]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-kind="plan"]')!.hasAttribute('data-bb-chat-ui-info-open'));
  stop();
  f.dom.window.close();
});

test("remounts and two composer scopes do not leak disclosures or hide each other's requests", async () => {
  const f = fixture();
  const shell = f.document.querySelector('[data-promptbox-shell]')!;
  const other = shell.cloneNode(true) as HTMLElement;
  f.document.body.append(other);
  const stop = injectComposerInfo(f.document);
  const bars = f.document.querySelectorAll('[data-bb-chat-ui-info-bar]');
  assert.equal(bars.length, 2);
  (bars[0].querySelector('[data-bb-chat-ui-info-all]') as HTMLButtonElement).click();
  assert.equal(other.querySelector('[data-bb-chat-ui-info-menu]'), null);
  other.querySelector('.grid')!.insertAdjacentHTML('afterbegin', '<section data-testid="user-question-banner"><button>Answer</button></section>');
  await f.tick();
  assert.equal(shell.querySelector('.grid')!.hasAttribute('data-bb-chat-ui-info-request'), false);
  assert.equal(other.querySelector('.grid')!.hasAttribute('data-bb-chat-ui-info-request'), true);
  shell.remove();
  await f.tick();
  assert.equal(shell.querySelector('[data-bb-chat-ui-info-bar]'), null);
  stop();
  assert.equal(other.querySelector('[data-bb-chat-ui-info-unit]'), null);
  f.dom.window.close();
});

test("a supplemental Diff settles while loading and after real summary changes without rewriting its title", async () => {
  const f = fixture();
  const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  stack.querySelector('section[aria-label="Thread context before sending"]')!.remove();
  const source = f.document.createElement('span');
  source.hidden = true;
  source.setAttribute('data-bb-chat-ui-head-diff', '');
  source.setAttribute('data-bb-chat-ui-head-diff-state', 'loading');
  stack.append(source);
  let measurements = 0;
  stack.getBoundingClientRect = () => { measurements++; return { width:900 } as DOMRect; };
  const stop = injectComposerInfo(f.document);
  let titleChanges = 0;
  const observer = new f.dom.window.MutationObserver(records => { titleChanges += records.length; });
  try {
    const button = stack.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-bar] > section[data-bb-chat-ui-info-unit] > button')!;
    assert.ok(button, 'the SDK summary supplies Diff when the native git card is absent');
    observer.observe(button, { attributes:true, attributeFilter:['title'] });
    for (const { ready, branch } of [{ ready:false, branch:null }, { ready:true, branch:null }, { ready:true, branch:'feature/chat' }]) {
      if (ready) {
        source.setAttribute('data-bb-chat-ui-head-diff-state', 'ready');
        source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify({ insertions:2, deletions:1, files:1, branch,
          presentation:{ mode:'working', visible:true, branch, branchLabel:branch, label:'+2 −1 · 1 file' },
        }));
      }
      await f.tick(); await f.tick(); await f.tick();
      assert.equal(button.title, branch ?? 'Code Diff', 'a changed branch still updates the native tooltip');
      if (ready) assert.match(stack.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!.textContent!, /\+2/);
      measurements = 0; titleChanges = 0;
      await f.tick(); await f.tick();
      assert.equal(titleChanges, 0, 'an unchanged supplemental title does not trigger its own observer');
      assert.equal(measurements, 0, 'an idle Diff does not keep scheduling layout work');
    }
  } finally { observer.disconnect(); stop(); f.dom.window.close(); }
});

test("Code Diff pill shows one commit meaning and keeps unpushed counts inside its popover", async () => {
  const f = fixture();
  const source = f.document.createElement('span');
  const name = 'feature/a-very-long-branch-name';
  const snapshot = {
    insertions:0, deletions:0, files:0, branch:name,
    presentation:{ mode:'branch', visible:true, branch:name, branchLabel:'feature/a…', label:'feature/a… · 8 commits' },
    detail:{ branch:name, basis:'HEAD 대비 미커밋 변경', baseRef:'origin/main', files:[],
      commitKind:'pr', commitCount:8, unpushedCount:3, unpushedRef:`origin/${name}`,
      commits:[{ sha:'abc12345678', shortSha:'abc1234', subject:'Saved work' }] },
  };
  const publish = () => source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify(snapshot));
  publish(); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!;
  assert.equal(pill.textContent, 'feature/a… · 8');
  assert.ok(pill.querySelector('[data-bb-chat-ui-info-commit-count] svg'));
  assert.equal(pill.querySelector('[data-bb-chat-ui-info-commit-count]')?.getAttribute('aria-label'), '커밋 8개');
  assert.equal(pill.textContent?.includes('↑'), false);
  assert.ok(pill.getAttribute('aria-label')?.includes(name));
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  const popup = f.document.querySelector('[data-bb-chat-ui-info-diff]')!;
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-branch]')?.textContent, name);
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')?.textContent, 'origin/main → HEAD · 8');
  assert.ok(popup.textContent?.includes('미푸시 · 3 commits'));
  const overview = popup.querySelector('[data-bb-chat-ui-info-diff-overview]')!;
  assert.ok(overview, 'branch, working tree, comparison and unpushed metadata share the top overview');
  assert.equal(overview.querySelector('[data-bb-chat-ui-info-diff-branch]')?.textContent, name);
  assert.equal(overview.querySelector('[data-bb-chat-ui-info-diff-meta="head"]')?.textContent, 'HEAD · +0 −0 · 0 files');
  assert.equal(overview.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')?.textContent, 'origin/main → HEAD · 8');
  assert.ok(overview.textContent?.includes('미푸시 · 3 commits'));
  assert.ok(overview.compareDocumentPosition(popup.querySelector('hr')!) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(overview.querySelector('[data-bb-chat-ui-info-diff-commit]'), null, 'individual commits stay below the overview divider');
  assert.ok(popup.textContent?.includes(`origin/${name} 대비`));
  assert.equal(popup.textContent?.includes('PR 후보는 아직 push하지 않은 로컬 커밋도 포함합니다.'), false);
  assert.equal(popup.textContent?.includes('원격 비교는 마지막으로 확인된 상태 기준입니다.'), false);
  assert.equal(popup.textContent?.includes('feature/a…'), false, 'popover uses the full branch name');
  assert.equal(popup.querySelectorAll('[data-bb-chat-ui-info-diff-file]').length, 0);
  snapshot.detail.unpushedCount = 0;
  publish(); await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff]'), popup);
  assert.ok(popup.textContent?.includes('미푸시 · 0 commits'));
  assert.equal(popup.querySelectorAll('[data-bb-chat-ui-info-diff-overview]').length, 1);
  assert.ok(popup.querySelector('[data-bb-chat-ui-info-diff-overview]')?.textContent?.includes('미푸시 · 0 commits'), 'refresh keeps secondary metadata in the overview');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.textContent, 'feature/a… · 8');
  stop(); f.dom.window.close();
});

test("first entry shows an animated Diff placeholder, then reveals SDK data without flashing host counts", async () => {
  for (const showEmptyIcons of [false,true]) {
    const f = fixture();
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({ showEmptyIcons }));
    const source = f.document.createElement('span');
    source.setAttribute('data-bb-chat-ui-head-diff','');
    f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
    const stop = injectComposerInfo(f.document);
    const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!;
    assert.ok(pill,'Diff enters before its slow first result');
    assert.equal(pill.textContent,'...','no provisional host line counts during loading');
    assert.equal(pill.getAttribute('aria-busy'),'true');
    assert.equal(pill.querySelectorAll('[data-bb-chat-ui-info-diff-loading] span').length,3);
    f.click('[data-bb-chat-ui-info-all]');
    assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="diff"]'),'catalog remains available');
    f.click('[data-bb-chat-ui-info-all]');
    source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({ insertions:0,deletions:0,files:0,branch:'feature/chat',
      presentation:{ mode:'branch',visible:true,branch:'feature/chat',branchLabel:'feature/c…',label:'feature/c… · 8 commits' },
      detail:{ branch:'feature/chat',basis:'HEAD 대비 미커밋 변경',baseRef:'origin/main',files:[],commits:[],commitKind:'pr',commitCount:8 },
    }));
    await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'),pill,'the same pill reveals its result');
    assert.equal(pill.textContent,'feature/c… · 8');
    assert.equal(pill.hasAttribute('aria-busy'),false);
    // A new thread's source is empty until its own first result arrives.
    source.setAttribute('data-bb-chat-ui-head-diff',''); await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.textContent,'...');
    source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({ insertions:0,deletions:0,files:0,branch:null,
      presentation:{ mode:'unpushed',visible:false,branch:'main',branchLabel:'main',label:'main' },
    }));
    await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'),null,'confirmed clean main still hides the pill');
    stop(); f.dom.window.close();
  }
});

test("Diff loading widens into its result once and respects reduced motion and unavailable environments", async () => {
  for (const reduced of [false,true]) {
    const f = fixture();
    Object.defineProperty(f.dom.window,'matchMedia',{value:()=>({matches:reduced})});
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showInactiveInfo":true,"showEmptyIcons":true}');
    const source = f.document.createElement('span'); source.setAttribute('data-bb-chat-ui-head-diff','');
    f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
    const entries:{key:string|null;frames:Keyframe[];options:KeyframeAnimationOptions;cancelled:boolean}[]=[];
    Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetWidth',{get() {
      return this.hasAttribute('data-bb-chat-ui-info-trigger') ? this.hasAttribute('aria-busy') ? 64 : 180 : 0;
    }});
    f.dom.window.HTMLElement.prototype.animate=function(frames,options) {
      const entry={key:this.getAttribute('data-bb-chat-ui-info-trigger'),frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,cancelled:false}; entries.push(entry);
      return {cancel:()=>{entry.cancelled=true;}} as Animation;
    };
    const stop=injectComposerInfo(f.document);
    const pill=f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!;
    source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({insertions:7,deletions:2,files:1,branch:'feature/chat',
      presentation:{mode:'working',visible:true,branch:'feature/chat',label:'+7 −2 · 1 file'},
    })); await f.tick();
    const width=entries.filter(entry=>entry.key==='diff'&&entry.frames[0].width);
    assert.equal(width.length,reduced?0:1);
    if(!reduced) {
      assert.deepEqual(width[0].frames.map(frame=>frame.width),['64px','180px']);
      assert.equal(width[0].options.duration,320);
      assert.equal(entries.filter(entry=>entry.key==='diff'&&entry.options.duration===460).length,1,'data arrival does not repeat the entry bubble');
    }
    assert.equal(pill.textContent,'+7 −2 · 1 file');
    const refreshed=JSON.parse(source.getAttribute('data-bb-chat-ui-head-diff')!);
    refreshed.detail={branch:'feature/chat',basis:'HEAD 대비 미커밋 변경',baseRef:'origin/main',files:[],commits:[]};
    source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify(refreshed)); await f.tick();
    if(!reduced) assert.equal(width[0].cancelled,false,'detail-only refresh does not interrupt the width transition');
    source.setAttribute('data-bb-chat-ui-head-diff','');
    source.setAttribute('data-bb-chat-ui-head-diff-state','unavailable'); await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]:not([data-bb-chat-ui-info-exiting])'),null,'confirmed missing environment ends the placeholder even with empty icons enabled');
    stop(); assert.ok(entries.filter(entry=>entry.options.duration!==360).every(entry=>entry.cancelled),'entry, width and content animations are cancelled on unload'); f.dom.window.close();
  }
});

test("loading Diff exists without a native banner and obeys top, catalog-only and off settings", async () => {
  const f=fixture();
  f.document.querySelector('section[aria-label="Thread context before sending"]')!.remove();
  const settings=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  const source=f.document.createElement('span'); source.setAttribute('data-bb-chat-ui-head-diff','');
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop=injectComposerInfo(f.document);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.textContent,'...');
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff-content]')?.textContent,'불러오는 중');
  settings.setAttribute('data-bb-chat-ui-info-settings','{"showDiff":"목록에만 표시"}'); await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'),null);
  f.click('[data-bb-chat-ui-info-all]');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-choice="diff"]'));
  settings.setAttribute('data-bb-chat-ui-info-settings','{"showDiff":"끄기"}'); await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-choice="diff"]'),null);
  stop(); f.dom.window.close();
});

test("entering another thread replays the sequence even when the composer DOM is reused", async () => {
  const f=fixture();
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  source.setAttribute('data-bb-chat-ui-info-thread','thread-a');
  const animated:string[]=[];
  f.dom.window.HTMLElement.prototype.animate=function(_frames,options) {
    if((options as KeyframeAnimationOptions).duration===460) animated.push(this.getAttribute('data-bb-chat-ui-info-trigger')??'all');
    return {cancel(){}} as Animation;
  };
  const stop=injectComposerInfo(f.document);
  const sequence = ['diff','goal','todos','queue','pullRequest','other','all'];
  assert.deepEqual(animated,sequence);
  source.setAttribute('data-bb-chat-ui-info-thread','thread-b'); await f.tick();
  assert.deepEqual(animated,[...sequence,...sequence]);
  f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
  assert.equal(animated.length,sequence.length * 2,'resize does not restart the sequence');
  stop(); f.dom.window.close();
});

test("clean main hides the pill even with empty icons enabled but remains in the catalog", async () => {
  const f = fixture();
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings', '{"showInactiveInfo":true,"showEmptyIcons":true}');
  const source = f.document.createElement('span');
  const snapshot = {
    insertions:0, deletions:0, files:0, branch:null,
    presentation:{ mode:'unpushed', visible:true, branch:'main', branchLabel:'main', label:'↑3' },
    detail:{ branch:'main', basis:'HEAD 대비 미커밋 변경', baseRef:'origin/main', files:[], commits:[], commitKind:'unpushed', commitCount:3, unpushedCount:3, unpushedRef:'origin/main' },
  };
  const publish = () => source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify(snapshot));
  publish(); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.textContent, '↑3');
  snapshot.presentation.visible = false; snapshot.presentation.label = 'main';
  snapshot.detail.commitCount = 0; snapshot.detail.unpushedCount = 0;
  publish(); await f.tick();
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'), null);
  f.click('[data-bb-chat-ui-info-all]');
  f.click('[data-bb-chat-ui-info-choice="diff"]');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff-branch]')?.textContent, 'main');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')?.textContent, 'origin/main → HEAD · 0');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')?.getAttribute('aria-label')?.includes('미푸시'));
  stop(); f.dom.window.close();
});

test("missing remote base is visible in the Diff catalog popover while clean main stays hidden", async () => {
  const f = fixture();
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showInactiveInfo":true,"showEmptyIcons":true}');
  const source = f.document.createElement('span');
  source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({ insertions:0,deletions:0,files:0,
    presentation:{ mode:'unpushed',visible:false,branch:'main',label:'main' },
    detail:{ branch:'main',basis:'HEAD 대비 미커밋 변경',baseRef:'origin/main',files:[],commits:[],commitKind:'unpushed',commitCount:null,remoteBaseMissing:true },
  }));
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]'),null);
  f.click('[data-bb-chat-ui-info-all]'); f.click('[data-bb-chat-ui-info-choice="diff"]');
  const meta = f.document.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')!;
  assert.equal(meta.textContent,'원격 기준 없음 · origin/main');
  assert.equal(meta.querySelector('[data-bb-chat-ui-info-commit-count]'),null,"unknown is not zero");
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff-branch]')?.textContent,'main');
  stop(); f.dom.window.close();
});

test("dirty Code Diff keeps HEAD stats and PR counts while hiding unknown unpushed information", () => {
  const f = fixture();
  const source = f.document.createElement('span');
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify({
    insertions:7, deletions:2, files:1, branch:'feature/chat',
    presentation:{ mode:'working', visible:true, branch:'feature/chat', branchLabel:null, label:'+7 −2 · 1 file' },
    detail:{ branch:'feature/chat', basis:'HEAD 대비 미커밋 변경', baseRef:'origin/main', files:[{ path:'draft.ts', status:'M', insertions:7, deletions:2 }], commits:[], commitKind:'pr', commitCount:8, unpushedCount:null, unpushedRef:'origin/feature/chat' },
  }));
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!;
  assert.equal(pill.textContent, '+7 −2 · 1 file');
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  const popup = f.document.querySelector('[data-bb-chat-ui-info-diff]')!;
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')?.textContent, 'origin/main → HEAD · 8');
  assert.equal(popup.textContent?.includes('미푸시'), false);
  assert.equal(popup.textContent?.includes('확인 불가'), false);
  assert.equal(popup.querySelectorAll('[data-bb-chat-ui-info-diff-file]').length, 1);
  stop(); f.dom.window.close();
});

test("Diff popover puts changed files before the commit heading and connected rail", async () => {
  const f = fixture();
  const source = f.document.createElement('span');
  const statuses = ['M','A','D','R','C','U','??'];
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify({ insertions:7, deletions:2, files:7, branch:'feature/chat', detail:{
    branch:'feature/chat', basis:'HEAD 대비 미커밋 변경', baseRef:'origin/main',
    files:statuses.map(status => ({ path:`${status.replace('??','new')}.ts`, status, insertions:1, deletions:0 })),
    commits:[1,2,3].map(n => ({ sha:`abc1234${n}`, shortSha:`abc123${n}`, subject:`Commit ${n}` })),
  } }));
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  const popup = f.document.querySelector('[data-bb-chat-ui-info-diff]')!;
  const rail = popup.querySelector('[data-bb-chat-ui-info-diff-commits]');
  const files = popup.querySelector('[data-bb-chat-ui-info-diff-files]');
  assert.ok(rail); assert.ok(files);
  const separator=popup.querySelector('hr');
  assert.ok(separator,'a semantic separator divides metadata from the lists');
  assert.ok(popup.querySelector('[data-bb-chat-ui-info-diff-meta="head"]')!.compareDocumentPosition(separator) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(separator.compareDocumentPosition(files) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(files.querySelector('h4')?.textContent,'변경 파일 · 7');
  const commitHeading=[...popup.querySelectorAll('h4')].find(heading=>heading.textContent==='커밋');
  assert.ok(commitHeading,'commits have their own short heading separate from comparison metadata');
  const sectionSeparator = popup.querySelectorAll('hr')[1];
  assert.ok(sectionSeparator,'changed files and commits have a separate divider');
  assert.ok(files.compareDocumentPosition(sectionSeparator) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(sectionSeparator.compareDocumentPosition(commitHeading) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(files.compareDocumentPosition(commitHeading) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')!.compareDocumentPosition(separator) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'the comparison summary is above the first divider');
  assert.ok(files.compareDocumentPosition(rail) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(rail.querySelectorAll('[data-bb-chat-ui-info-diff-commit]').length, 3);
  assert.equal(rail.querySelectorAll('[data-bb-chat-ui-info-diff-graph] svg circle').length, 3);
  for (const [index,row] of [...files.querySelectorAll('[data-bb-chat-ui-info-diff-file]')].entries()) {
    const icon = row.firstElementChild;
    assert.equal(icon?.tagName.toLowerCase(), 'svg');
    assert.equal(icon?.getAttribute('data-bb-chat-ui-info-file-status'), statuses[index]);
    assert.ok(icon?.getAttribute('aria-label'));
    assert.equal(icon?.getAttribute('aria-hidden'), null);
    assert.ok(row.textContent?.includes('+1'), 'file statistics stay readable after the status icon');
  }
  assert.ok(files.querySelector('[data-bb-chat-ui-info-file-status="A"]')?.classList.contains('text-diff-added'));
  assert.ok(files.querySelector('[data-bb-chat-ui-info-file-status="D"]')?.classList.contains('text-diff-removed'));
  const updated = JSON.parse(source.getAttribute('data-bb-chat-ui-head-diff')!);
  updated.detail.files.pop();
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify(updated)); await f.tick();
  const refreshedFiles = popup.querySelector('[data-bb-chat-ui-info-diff-files]')!;
  assert.equal(refreshedFiles.querySelectorAll('[data-bb-chat-ui-info-diff-file]').length, 6);
  assert.equal(popup.querySelectorAll('hr').length,2,'refresh replaces rather than duplicates both separators');
  assert.equal([...popup.querySelectorAll('h4')].filter(heading=>heading.textContent==='커밋').length,1);
  assert.ok(refreshedFiles.compareDocumentPosition(popup.querySelector('[data-bb-chat-ui-info-diff-commits]')!) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'open popover refresh keeps changed files above commit contents');
  assert.ok(popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]')!.compareDocumentPosition(popup.querySelector('hr')!) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'refresh keeps the comparison summary in the overview');
  const content = popup.querySelector('[data-bb-chat-ui-info-diff-content]')!;
  const sectionOrder = () => [...content.children].map(node => {
    if (node.tagName === 'HR') return 'hr';
    if (node.hasAttribute('data-bb-chat-ui-info-diff-overview')) return 'overview';
    if (node.hasAttribute('data-bb-chat-ui-info-diff-files')) return 'files';
    if (node.hasAttribute('data-bb-chat-ui-info-diff-commits')) return 'commits';
    if (node.tagName === 'H4') return node.textContent;
    return node.tagName;
  });
  const hyphenLines = (section: Element) => [...section.children].filter(node => node.textContent === '-');
  updated.detail.files = [];
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify(updated)); await f.tick();
  const emptyFiles = popup.querySelector('[data-bb-chat-ui-info-diff-files]')!;
  assert.equal(emptyFiles.querySelector('h4')?.textContent,'변경 파일 · 0');
  assert.equal(hyphenLines(emptyFiles).length,1,'an empty file list shows one ASCII hyphen under its title');
  assert.equal(emptyFiles.querySelectorAll('[data-bb-chat-ui-info-diff-file]').length,0);
  assert.equal(popup.querySelectorAll('[data-bb-chat-ui-info-diff-commit]').length,3,'commit rows stay when only files are empty');
  assert.equal(hyphenLines(popup.querySelector('[data-bb-chat-ui-info-diff-commits]')!).length,0);
  assert.ok(popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]'),'commit comparison stays while commit rows remain');
  assert.deepEqual(sectionOrder(),['overview','hr','files','hr','커밋','commits']);
  updated.detail.files = [{path:'only.ts',status:'M',insertions:1,deletions:0}];
  updated.detail.commits = [];
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify(updated)); await f.tick();
  const onlyFiles = popup.querySelector('[data-bb-chat-ui-info-diff-files]')!;
  assert.equal(onlyFiles.querySelector('h4')?.textContent,'변경 파일 · 1');
  assert.equal(onlyFiles.querySelector('[data-bb-chat-ui-info-diff-file] code')?.textContent,'only.ts');
  assert.equal(hyphenLines(onlyFiles).length,0);
  const emptyCommits = popup.querySelector('[data-bb-chat-ui-info-diff-commits]')!;
  assert.equal([...popup.querySelectorAll('h4')].filter(heading => heading.textContent === '커밋').length,1);
  assert.equal(hyphenLines(emptyCommits).length,1,'an empty commit list shows one ASCII hyphen under its title');
  assert.equal(emptyCommits.querySelectorAll('[data-bb-chat-ui-info-diff-commit]').length,0);
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"]'),null,'no commit kind and no rows add no comparison metadata');
  assert.deepEqual(sectionOrder(),['overview','hr','files','hr','커밋','commits']);
  updated.detail.files = [];
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify(updated)); await f.tick();
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-files] h4')?.textContent,'변경 파일 · 0');
  assert.equal(hyphenLines(popup.querySelector('[data-bb-chat-ui-info-diff-files]')!).length,1,'both empty lists keep the file hyphen');
  assert.equal(hyphenLines(popup.querySelector('[data-bb-chat-ui-info-diff-commits]')!).length,1,'both empty lists keep the commit hyphen');
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-meta="head"]')?.textContent?.includes('HEAD'),true);
  assert.equal(popup.textContent?.includes('원격 기준 없음'),false);
  assert.deepEqual(sectionOrder(),['overview','hr','files','hr','커밋','commits']);
  updated.detail.files = [{path:'back.ts',status:'A',insertions:2,deletions:1}];
  updated.detail.commits = [{sha:'abc1234',shortSha:'abc1234',subject:'Returned',authoredAt:1}];
  source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify(updated)); await f.tick();
  const returnedFiles = popup.querySelector('[data-bb-chat-ui-info-diff-files]')!;
  const returnedCommits = popup.querySelector('[data-bb-chat-ui-info-diff-commits]')!;
  assert.equal(returnedFiles.querySelector('h4')?.textContent,'변경 파일 · 1');
  assert.equal(returnedFiles.querySelector('[data-bb-chat-ui-info-diff-file] code')?.textContent,'back.ts');
  assert.equal(hyphenLines(returnedFiles).length,0,'returning files replace the hyphen');
  assert.equal(returnedCommits.querySelector('[data-bb-chat-ui-info-diff-commit] code')?.textContent,'abc1234 · Returned');
  assert.equal(hyphenLines(returnedCommits).length,0,'returning commits replace the hyphen');
  assert.equal(popup.querySelector('[data-bb-chat-ui-info-diff-meta="commits"] code')?.textContent,'origin/main → HEAD');
  assert.equal([...popup.querySelectorAll('h4')].filter(heading => heading.textContent === '커밋').length,1);
  assert.equal(popup.querySelectorAll('hr').length,2);
  assert.deepEqual(sectionOrder(),['overview','hr','files','hr','커밋','commits']);
  stop(); f.dom.window.close();
});

test("Diff popover orders commits by latest authored time, stably, and sorts refreshed lists", async () => {
  const f = fixture();
  const source = f.document.createElement('span');
  const commits = [
    { sha:'old-sha',shortSha:'old',subject:'Older',authoredAt:100 },
    { sha:'new-sha',shortSha:'new',subject:'Latest',authoredAt:300 },
    { sha:'middle-sha',shortSha:'middle',subject:'Middle',authoredAt:200 },
    { sha:'tie-sha',shortSha:'tie',subject:'Same time',authoredAt:300 },
  ];
  const snapshot = { insertions:0,deletions:0,files:0,branch:'feature/chat',detail:{
    branch:'feature/chat',basis:'HEAD 대비 미커밋 변경',baseRef:'origin/main',files:[],commits,
  } };
  const publish = () => source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify(snapshot));
  publish(); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  f.click('[data-bb-chat-ui-info-trigger="diff"]');
  const rows = () => [...f.document.querySelectorAll('[data-bb-chat-ui-info-diff-commit] code')].map(row=>row.textContent);
  assert.deepEqual(rows(),['new · Latest','tie · Same time','middle · Middle','old · Older']);
  assert.deepEqual(commits.map(c=>c.shortSha),['old','new','middle','tie'],'source order is not mutated');
  commits.push({sha:'fresh-sha',shortSha:'fresh',subject:'Just committed',authoredAt:400});
  publish(); await f.tick();
  assert.deepEqual(rows(),['fresh · Just committed','new · Latest','tie · Same time','middle · Middle','old · Older']);
  stop(); f.dom.window.close();
});

test("Diff lists show five rows and independently expand their remaining rows across refreshes", async () => {
  const f = fixture();
  const source = f.document.createElement('span');
  const snapshot = { insertions:8, deletions:0, files:8, branch:'feature/chat', detail:{
    branch:'feature/chat', basis:'HEAD 대비 미커밋 변경', baseRef:'origin/main',
    files:Array.from({length:8}, (_,n) => ({path:`file-${n}.ts`,status:'M',insertions:1,deletions:0})),
    commits:Array.from({length:7}, (_,n) => ({sha:`sha-${n}`,shortSha:`${n}`,subject:`Commit ${n}`,authoredAt:n})),
  } };
  const publish = () => source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify(snapshot));
  publish(); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  const visible = (kind:string) => [...f.document.querySelectorAll<HTMLElement>(`[data-bb-chat-ui-info-diff-${kind}]`)].filter(row => !row.hidden);
  const toggle = (kind:string) => f.document.querySelector<HTMLButtonElement>(`[data-bb-chat-ui-info-diff-toggle="${kind}"]`)!;
  try {
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    assert.equal(visible('file').length,5);
    assert.equal(visible('commit').length,5);
    assert.deepEqual(visible('commit').map(row=>row.querySelector('code')?.textContent),
      ['6 · Commit 6','5 · Commit 5','4 · Commit 4','3 · Commit 3','2 · Commit 2']);
    for (const kind of ['files','commits']) {
      assert.equal(toggle(kind).getAttribute('aria-expanded'),'false');
      const css=resolvedStyle(toggle(kind));
      assert.equal(css.boxShadow,'none','more/collapse is a plain row without its own glass shadow');
      assert.equal(css.backgroundColor,'rgba(0, 0, 0, 0)','more/collapse has no separate background');
      assert.ok(f.document.getElementById(toggle(kind).getAttribute('aria-controls')!));
    }
    assert.equal(toggle('files').textContent,'3개 더 보기');
    assert.equal(toggle('commits').textContent,'2개 더 보기');
    const hidden = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-diff-file][hidden]')!;
    assert.equal(resolvedStyle(hidden).display,'none','hidden rows do not occupy the scroll view');
    toggle('files').click();
    assert.equal(visible('file').length,8);
    assert.equal(visible('commit').length,5,'opening files does not open commits');
    assert.equal(toggle('files').getAttribute('aria-expanded'),'true');
    assert.equal(toggle('files').textContent,'접기');
    snapshot.detail.files.push({path:'file-8.ts',status:'A',insertions:1,deletions:0});
    snapshot.files++;
    snapshot.detail.commits.push({sha:'sha-7',shortSha:'7',subject:'Commit 7',authoredAt:7});
    publish(); await f.tick();
    assert.equal(visible('file').length,9,'open files stay expanded on refresh');
    assert.equal(visible('commit').length,5,'closed commits stay collapsed on refresh');
    assert.equal(toggle('commits').textContent,'3개 더 보기');
    toggle('commits').click();
    assert.equal(visible('commit').length,8);
    toggle('files').click();
    assert.equal(visible('file').length,5);
    assert.equal(visible('commit').length,8,'closing files leaves commits open');
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    assert.equal(visible('file').length,5,'reopening resets the preview');
    assert.equal(visible('commit').length,5);
  } finally { stop(); f.dom.window.close(); }
});

test("Diff lists with five or fewer rows have no collapse control", () => {
  const f = fixture();
  const source = f.document.createElement('span');
  source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({insertions:5,deletions:0,files:5,branch:'feature/chat',detail:{
    branch:'feature/chat',basis:'HEAD 대비 미커밋 변경',baseRef:'origin/main',
    files:Array.from({length:5}, (_,n)=>({path:`file-${n}.ts`,status:'M',insertions:1,deletions:0})),
    commits:Array.from({length:5}, (_,n)=>({sha:`sha-${n}`,shortSha:`${n}`,subject:`Commit ${n}`})),
  }}));
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="diff"]');
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-diff-toggle]'),null);
    assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-diff-file]:not([hidden])').length,5);
    assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-diff-commit]:not([hidden])').length,5);
  } finally { stop(); f.dom.window.close(); }
});

test("Diff numeric updates roll only changed values while exposing the new count immediately", async () => {
  for (const reduced of [false,true]) {
    const f = fixture();
    Object.defineProperty(f.dom.window,'matchMedia',{ value:() => ({ matches:reduced }) });
    const stop = injectComposerInfo(f.document);
    const pill = () => f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!;
    const number = (key:string) => pill().querySelector(`[data-bb-chat-ui-info-diff-number="${key}"]`)!;
    assert.equal(pill().querySelector('[data-bb-chat-ui-info-diff-previous]'),null,'first display does not roll');
    f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent = '+38 −4 · 12 files';
    await f.tick();
    assert.equal(number('added').getAttribute('data-bb-chat-ui-info-diff-value'),'38');
    assert.equal(number('files').getAttribute('data-bb-chat-ui-info-diff-value'),'12');
    assert.equal(pill().getAttribute('aria-label')?.includes('+38 −4 · 12 files'),true);
    assert.equal(number('removed').querySelector('[data-bb-chat-ui-info-diff-previous]'),null,'unchanged digits stay still');
    assert.equal(pill().querySelectorAll('[data-bb-chat-ui-info-diff-previous]').length,reduced ? 0 : 2);
    if (!reduced) {
      assert.equal(number('added').querySelector('[data-bb-chat-ui-info-diff-previous]')?.getAttribute('aria-hidden'),'true');
      f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent = '+7 −4 · 12 files'; await f.tick();
      assert.equal(number('added').querySelector('[data-bb-chat-ui-info-diff-previous]')?.getAttribute('data-bb-chat-ui-info-diff-value'),'38','rapid updates use the last real value');
      const current = number('added').querySelector('[data-bb-chat-ui-info-diff-current]')!;
      current.dispatchEvent(new f.dom.window.Event('animationend'));
      assert.equal(number('added').textContent,'7','finished transitions remove the old display');
    }
    stop(); f.dom.window.close();
  }
});

test("Diff roulette supports PR and main commit counts without rolling digits in branch names", async () => {
  for (const mode of ['branch','unpushed']) {
    const f = fixture();
    const source = f.document.createElement('span');
    let count = 3;
    const publish = () => source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({
      insertions:0,deletions:0,files:0,
      presentation:{ mode,visible:true,branch:mode === 'branch' ? 'chat-2026' : 'main',branchLabel:'chat-2026',label:mode === 'branch' ? `chat-2026 · ${count} commits` : `↑${count}` },
      detail:{ commitCount:count },
    }));
    publish(); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
    const records: ReturnType<ReturnType<typeof stubAnimations>>[]=[];
    const animate=stubAnimations(f.dom.window);
    f.dom.window.HTMLElement.prototype.animate=function(frames,options) {
      const record=animate.call(this,frames,options); records.push(record); return record.animation;
    };
    const stop = injectComposerInfo(f.document);
    for (const record of records) if (record.options.duration===460) record.animation.onfinish?.(new f.dom.window.Event('finish') as unknown as AnimationPlaybackEvent);
    const pill = f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')!;
    assert.equal(pill.querySelectorAll('[data-bb-chat-ui-info-diff-number]').length,1);
    count = 8; publish(); await f.tick();
    const number = pill.querySelector('[data-bb-chat-ui-info-diff-number="commits"]')!;
    assert.equal(number.textContent,'8','old digits do not contaminate the real displayed text');
    assert.equal(number.querySelector('[data-bb-chat-ui-info-diff-previous]')?.getAttribute('data-bb-chat-ui-info-diff-value'),'3');
    if (mode === 'branch') assert.equal(pill.querySelector('[data-bb-chat-ui-info-commit-count]')?.getAttribute('aria-label'),'커밋 8개');
    else assert.equal(pill.textContent,'↑8');
    assert.equal(records.filter(record=>record.options.duration===420).length,0,'PR and main commit counts only roll');
    const current = number.querySelector('[data-bb-chat-ui-info-diff-current]');
    f.document.querySelector('[aria-label="Goal"]')!.append(' updated'); await f.tick();
    assert.equal(number.querySelector('[data-bb-chat-ui-info-diff-current]'),current,'unrelated data preserves the current transition');
    stop();
    assert.equal(pill.isConnected,false,'unloading removes the transitioning pill');
    f.dom.window.close();
  }
});

test("Diff ignores file-count grammar changes but retains branch and icon hops", async () => {
  const f=fixture();
  const records: ReturnType<ReturnType<typeof stubAnimations>>[]=[];
  const animate=stubAnimations(f.dom.window);
  f.dom.window.HTMLElement.prototype.animate=function(frames,options) {
    const record=animate.call(this,frames,options); records.push(record); return record.animation;
  };
  const source=f.document.createElement('span');
  let files=1, branch='feature/2026';
  const publish=() => source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({
    insertions:files,deletions:0,files,
    presentation:{mode:'working',visible:true,branch,label:`+${files} −0 · ${files} ${files===1 ? 'file' : 'files'}`},
  }));
  publish(); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const stop=injectComposerInfo(f.document);
  try {
    for (const record of records) if (record.options.duration===460) record.animation.onfinish?.(new f.dom.window.Event('finish') as unknown as AnimationPlaybackEvent);
    records.length=0;
    const diffHops=() => records.filter(record=>record.options.duration===420 && record.node.matches('[data-bb-chat-ui-info-trigger="diff"]'));
    for (const count of [2,10,1]) {
      files=count; publish(); await f.tick();
      assert.equal(diffHops().length,0,'singular/plural and digit-width changes are numeric-only');
      assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"] [data-bb-chat-ui-info-diff-current]'),'numeric changes retain roulette');
    }
    branch='feature/2027'; publish(); await f.tick();
    assert.equal(diffHops().length,1,'branch-name digits are not treated as counters');
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.insertAdjacentHTML('beforeend','<span data-bb-chat-ui-info-icon="diff"><svg data-new-diff-icon /></span>');
    await f.tick();
    assert.equal(diffHops().length,2,'a different icon still hops');
  } finally { stop(); f.dom.window.close(); }
});

test("a loading Diff with no result fades away, staying inert and cancelling when data returns", async () => {
  for (const result of ['non-git','clean-main']) for (const reduced of [false,true]) {
    const f = fixture();
    Object.defineProperty(f.dom.window,'matchMedia',{ value:() => ({ matches:reduced }) });
    Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetWidth',{get() { return this.hasAttribute('data-bb-chat-ui-info-trigger') ? 64 : 0; }});
    const source = f.document.createElement('span'); source.setAttribute('data-bb-chat-ui-head-diff','');
    f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
    const exits:{ node:HTMLElement; frames:Keyframe[]; options:KeyframeAnimationOptions; animation:Animation; cancelled:boolean }[] = [];
    f.dom.window.HTMLElement.prototype.animate = function(frames,options) {
      const entry = { node:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,animation:null as unknown as Animation,cancelled:false };
      entry.animation = { cancel:() => { entry.cancelled=true; } } as Animation;
      if (this.hasAttribute('data-bb-chat-ui-info-exiting')) exits.push(entry);
      return entry.animation;
    };
    const stop = injectComposerInfo(f.document);
    assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"][aria-busy]'));
    if (result === 'non-git') source.setAttribute('data-bb-chat-ui-head-diff-state','unavailable');
    else source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({insertions:0,deletions:0,files:0,presentation:{mode:'unpushed',visible:false,branch:'main',label:'main'}}));
    await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]:not([data-bb-chat-ui-info-exiting])'),null);
    assert.equal(exits.length,reduced ? 0 : 1);
    if (!reduced) {
      assert.equal(exits[0].options.duration,200);
      assert.equal(exits[0].frames.at(-1)?.opacity,0);
      assert.equal(exits[0].frames[0].width,'64px','the departing pill keeps its original slot initially');
      assert.equal(exits[0].frames.at(-1)?.width,'0px','the slot shrinks with the visible pill');
      assert.notEqual(exits[0].node.style.position,'absolute','neighbours follow the shrinking slot instead of jumping');
      assert.equal(exits[0].node.style.transformOrigin,'left center','the departing pill shrinks towards its left edge');
      assert.equal(exits[0].node.nextElementSibling,f.document.querySelector('[data-bb-chat-ui-info-trigger="children"]'),'the exit stays in the original pill order');
      assert.equal(exits[0].node.getAttribute('aria-hidden'),'true');
      assert.equal(exits[0].node.hasAttribute('disabled'),true);
      source.setAttribute('data-bb-chat-ui-head-diff-state','ready');
      source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({insertions:2,deletions:0,files:1,presentation:{mode:'working',visible:true,branch:'main',label:'+2 −0 · 1 file'}}));
      await f.tick();
      assert.equal(exits[0].cancelled,true);
      assert.equal(exits[0].node.isConnected,false,'returning data cannot leave a second ghost pill');
      assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-trigger="diff"]').length,1);
      source.setAttribute('data-bb-chat-ui-head-diff',''); source.setAttribute('data-bb-chat-ui-head-diff-state','loading'); await f.tick();
      source.setAttribute('data-bb-chat-ui-head-diff-state','unavailable'); await f.tick();
      assert.equal(exits.length,2);
      if (result === 'clean-main') {
        const finish = exits[1].animation.onfinish as (() => void) | null;
        finish?.();
        assert.equal(exits[1].node.isConnected,false,'completion removes the visual placeholder');
      }
    }
    stop(); assert.equal(f.document.querySelector('[data-bb-chat-ui-info-exiting]'),null);
    if (!reduced && result === 'non-git') assert.equal(exits[1].cancelled,true,'unload cancels an unfinished exit');
    f.dom.window.close();
  }
});

// A new queued message detaches from the composer and is received by the visible queue surface.
test("every queued addition sends a droplet, including equal-count replacement and catalog-only queues", async () => {
  const f = fixture();
  const settings = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  settings.setAttribute('data-bb-chat-ui-info-settings','{"showQueue":"상단 표시"}');
  const queue = f.document.querySelector('section[aria-label="Queued messages"]')!;
  queue.querySelector('header button')!.innerHTML = '<span data-queued-messages-count>2</span>';
  const count = queue.querySelector('[data-queued-messages-count]')!;
  const rows = queue.querySelector('#queue')!;
  const add = (id:string) => { const row = f.document.createElement('div'); row.setAttribute('data-queued-message-id',id); rows.append(row); return row; };
  const a = add('a'); const b = add('b');
  f.document.querySelector('[data-promptbox-shell]')!.insertAdjacentHTML('beforeend','<button data-promptbox-submit-action type="submit">Send</button>');
  const records:{ node:HTMLElement; options:KeyframeAnimationOptions; animation:Animation; cancelled:boolean }[] = [];
  const animate = stubAnimations(f.dom.window);
  f.dom.window.HTMLElement.prototype.animate = function(_frames,options) {
    const record = animate.call(this, _frames, options); records.push(record); return record.animation;
  };
  const stop = injectComposerInfo(f.document);
  const flights = () => records.filter(record => record.node.classList.contains('bbk-drop'));
  assert.equal(flights().length,0,'existing queue content is not a new send');
  add('c'); count.textContent='3'; await f.tick();
  assert.equal(flights().length,1);
  assert.equal(flights()[0].options.duration,1000,'the selected uninterrupted droplet covers separation through absorption');
  assert.ok(flights()[0].node.closest('[data-queue-liquid]')?.querySelector('[data-liquid-edge="source"]'),'the composer surface supplies the departure');
  assert.equal(records.some(record=>record.node===f.document.querySelector('[data-promptbox-submit-action]')),false,'the send button does not detach or squash');
  assert.match(composerInfoCss,/body > \.bbk-drop \{[^}]*z-index:54/);
  assert.match(composerInfoCss,/--bbk-drop-face:oklch\(from var\(--bb-chat-ui-glass-base, var\(--background\)\) min\(1, calc\(l \+ 0\.075\)\) c h \/ 0\.68\)/);
  assert.match(composerInfoCss,/\.dark body > \.bbk-drop, body\.dark > \.bbk-drop \{[^}]*--bbk-drop-face:oklch\(from var\(--bb-chat-ui-glass-base, var\(--background\)\) min\(1, calc\(l \+ 0\.075\)\) c h \/ 0\.76\)/);
  assert.match(composerInfoCss,/--bbk-drop-edge:color-mix\(in oklab,var\(--popover\) 35%,transparent\)/);
  assert.match(composerInfoCss,/--bbk-drop-edge:color-mix\(in oklab,var\(--foreground\) 8%,transparent\)/);
  assert.doesNotMatch(composerInfoCss,/data-bb-chat-ui-info-queue-drop/);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]')?.textContent,'3','count updates without waiting for the flight');
  add('d'); count.textContent='4'; await f.tick();
  assert.equal(flights().length,2,'the second send also flies while the first animation is running');
  a.remove(); count.textContent='3'; await f.tick(); assert.equal(flights().length,2,'removal is not an addition');
  b.setAttribute('data-queued-message-id','replacement'); await f.tick();
  assert.equal(flights().length,3,'a new message is detected even when the count stays the same');
  const finish = flights()[2].animation.onfinish as (() => void) | null; finish?.();
  assert.equal(flights()[2].node.isConnected,false);
  const finishedMotion = flights()[2];
  settings.setAttribute('data-bb-chat-ui-info-settings','{"showQueue":"목록에만 표시"}'); await f.tick();
  add('e'); count.textContent='4'; await f.tick();
  assert.equal(flights().length,4);
  assert.ok(flights()[3].node.closest('[data-queue-liquid]')?.querySelector('[data-liquid-edge="target"]'),'the visible stack circle also receives a liquid surface');
  const finishOrb = flights()[3].animation.onfinish as (() => void) | null; finishOrb?.();
  settings.setAttribute('data-bb-chat-ui-info-thread','other-thread'); await f.tick();
  assert.equal(flights().length,4,'thread changes reset the baseline');
  assert.ok(flights().filter(record => record.node.isConnected).length===0,'scope changes remove flying droplets');
  assert.ok(flights().slice(0,2).every(record=>record.cancelled));
  assert.equal(finishedMotion.cancelled,false,'a finished liquid motion is no longer tracked');
  add('f'); count.textContent='5'; await f.tick(); assert.equal(flights().length,5);
  count.textContent='6'; await f.tick(); assert.equal(flights().length,6,'a collapsed list can update its count before rendering the new row');
  add('late-row'); await f.tick(); assert.equal(flights().length,6,'later detail rendering does not repeat the send');
  stop(); assert.equal(f.document.querySelector('.bbk-drop'),null);
  assert.equal(flights().at(-1)?.cancelled,true);
  assert.equal(finishedMotion.cancelled,false);
  f.dom.window.close();
});

// A new queue pill stays at rest until contact instead of bouncing in during its first absorption.
test("the first queued message receives a droplet without a competing entrance", async () => {
  const f=fixture(),queue=f.document.querySelector('section[aria-label="Queued messages"]')!,parent=queue.parentElement!;
  queue.remove();
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showQueue":"상단 표시"}');
  const records:ReturnType<ReturnType<typeof stubAnimations>>[]=[];
  const animate=stubAnimations(f.dom.window);
  // Record the first pill entrance separately from its incoming liquid shape.
  f.dom.window.HTMLElement.prototype.animate=function(frames,options){const record=animate.call(this,frames,options);records.push(record);return record.animation;};
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]'),null);
    queue.querySelector('header button')!.innerHTML='<span data-queued-messages-count>1</span>';
    queue.querySelector('#queue')!.insertAdjacentHTML('beforeend','<div data-queued-message-id="first"></div>');
    parent.append(queue);await f.tick();
    const pill=f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]')!;
    assert.ok(pill);
    assert.equal(records.filter(record=>record.node.classList.contains('bbk-drop')).length,1);
    const reactions=records.filter(record=>record.node===pill&&record.frames.some(frame=>frame.transform));
    assert.equal(reactions.length,1,'first-message absorption has one receiving response without an entrance bounce');
    assert.equal(reactions[0].options.duration,380);
    assert.ok(Number(reactions[0].options.delay)>=0);
  } finally {stop();f.dom.window.close();}
});

// The origin remains the input surface even when a send button exists or the composer needs a textarea fallback.
test("queue droplets use fallback input coordinates without animating the composer", async () => {
  for (const fallback of ['composer','textarea']) {
    const f=fixture();
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showQueue":"상단 표시"}');
    if (fallback==='textarea') f.document.querySelector('[data-follow-up-composer]')!.removeAttribute('data-follow-up-composer');
    const origin=f.document.querySelector<HTMLElement>(fallback==='composer' ? '[data-follow-up-composer]' : 'textarea')!;
    origin.getBoundingClientRect=() => ({left:40,top:100,width:200,height:80,right:240,bottom:180,x:40,y:100,toJSON:()=>({})});
    const records: ReturnType<ReturnType<typeof stubAnimations>>[]=[];
    const animate=stubAnimations(f.dom.window);
    f.dom.window.HTMLElement.prototype.animate=function(frames,options) {
      const record=animate.call(this,frames,options); records.push(record); return record.animation;
    };
    const queue=f.document.querySelector('section[aria-label="Queued messages"]')!;
    queue.querySelector('header button')!.innerHTML='<span data-queued-messages-count>2</span>';
    const counter=queue.querySelector('[data-queued-messages-count]')!;
    const stop=injectComposerInfo(f.document);
    try {
      for (const count of [3,4]) {
        counter.textContent=String(count); await f.tick();
        const flights=records.filter(record=>record.node.classList.contains('bbk-drop'));
        assert.equal(flights.length,count-2,'each addition sends exactly one droplet');
        const liquid=flights.at(-1)!.node.closest('[data-queue-liquid]')!;
        assert.equal(liquid.querySelector('[data-liquid-edge="source"]')?.getAttribute('data-edge-x'),'64','an outside target clamps the departure to the composer edge');
        assert.equal(records.filter(record=>record.node===origin).length,0,'no animation touches the fallback composer');
        assert.equal(liquid.querySelector('[data-liquid-edge="source"]')?.getAttribute('data-edge-y'),'100');
        assert.ok(liquid.querySelector('[data-liquid-edge="target"]'),'the same mask connects to the receiving surface');
        assert.equal(f.document.querySelector('[data-bb-chat-ui-info-trigger="queue"]')?.textContent,String(count),'counter is immediate');
        flights.at(-1)!.animation.onfinish?.(new f.dom.window.Event('finish') as unknown as AnimationPlaybackEvent);
        assert.equal(f.document.querySelector('.bbk-drop'),null,'finished droplets leave no DOM');
      }
    } finally { stop(); f.dom.window.close(); }
  }
});

test("a queue addition without WAAPI does not throw or leave a drop", async () => {
  const f = fixture();
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showQueue":"상단 표시"}');
  const queue = f.document.querySelector('section[aria-label="Queued messages"]')!;
  queue.querySelector('header button')!.innerHTML = '<span data-queued-messages-count>1</span>';
  const rows = queue.querySelector('#queue')!;
  const add = (id: string) => { const row = f.document.createElement('div'); row.setAttribute('data-queued-message-id', id); rows.append(row); };
  add('a');
  delete (f.dom.window.HTMLElement.prototype as { animate?: unknown }).animate;
  const errors: unknown[] = [];
  f.dom.window.addEventListener('error', event => { errors.push(event.error ?? event.message); });
  const stop = injectComposerInfo(f.document);
  add('b');
  queue.querySelector('[data-queued-messages-count]')!.textContent = '2';
  await f.tick();
  assert.deepEqual(errors, []);
  assert.equal(f.document.querySelector('.bbk-drop'), null);
  stop();
  f.dom.window.close();
});

test("queued addition motion respects reduced motion and disabled queue settings", async () => {
  for (const reduced of [true,false]) {
    const f=fixture();
    Object.defineProperty(f.dom.window,'matchMedia',{value:()=>({matches:reduced})});
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({showQueue:reduced?'상단 표시':'끄기'}));
    const header=f.document.querySelector('section[aria-label="Queued messages"] header button')!;
    header.innerHTML='<span data-queued-messages-count>1</span>';
    let flights=0;
    f.dom.window.HTMLElement.prototype.animate=function() { if(this.classList.contains('bbk-drop')) flights++; return {cancel(){}} as Animation; };
    const stop=injectComposerInfo(f.document);
    header.querySelector('span')!.textContent='2'; await f.tick();
    assert.equal(flights,0);
    stop();f.dom.window.close();
  }
});

test("existing pills slide sideways when a new pill enters ahead of them", async () => {
  const f=fixture();
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showGoal":"상단 표시"}');
  f.document.querySelector('[data-promptbox-shell] > .grid')!.getBoundingClientRect=()=>({width:310} as DOMRect);
  const source=f.document.createElement('span');
  const publish=(visible:boolean) => source.setAttribute('data-bb-chat-ui-head-diff',JSON.stringify({insertions:0,deletions:0,files:0,presentation:{mode:'branch',visible,branch:'feature/chat',label:'feature/c…'}}));
  publish(false); f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetWidth',{get(){return this.hasAttribute('data-bb-chat-ui-info-trigger') ? 64 : 0;}});
  Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetLeft',{get(){let x=0; for(let n=this.previousElementSibling;n;n=n.previousElementSibling) if(!n.hidden) x+=72; return x;}});
  const moves:{node:HTMLElement;frames:Keyframe[];cancelled:boolean}[]=[];
  f.dom.window.HTMLElement.prototype.animate=function(frames){const record={node:this,frames:frames as Keyframe[],cancelled:false}; if(record.frames[0].translate && record.frames[0].opacity === undefined && !this.parentElement?.hasAttribute("data-bb-chat-ui-info-stack-icons")) moves.push(record); return {cancel(){record.cancelled=true;}} as Animation;};
  const stop=injectComposerInfo(f.document);
  assert.equal(moves.length,0,'initial entry retains its droplet animation');
  const child=f.document.querySelector('[data-bb-chat-ui-info-trigger="children"]');
  publish(true); await f.tick();
  const move=moves.find(record=>record.node===child)!;
  assert.ok(move,'an existing pill is pushed without jumping');
  assert.ok(f.document.querySelector('[data-bb-chat-ui-info-exiting]'),'overflow retirement must not block neighbours moving sideways');
  assert.equal(move.frames[0].translate,'-72px 0');
  assert.equal(move.frames.at(-1)?.translate,'0px 0');
  stop(); assert.ok(move.cancelled,'unload cancels lateral motion'); f.dom.window.close();
});

test("ordinary disappearing pills keep an inert shrinking slot and clear it when they return", async () => {
  const f=fixture(); f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showGoal":"상단 표시"}');
  Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetWidth',{get(){return this.hasAttribute('data-bb-chat-ui-info-trigger') ? 64 : 0;}});
  const exits:{node:HTMLElement;frames:Keyframe[];cancelled:boolean}[]=[];
  f.dom.window.HTMLElement.prototype.animate=function(frames){const record={node:this,frames:frames as Keyframe[],cancelled:false}; if(this.hasAttribute('data-bb-chat-ui-info-exiting')) exits.push(record); return {cancel(){record.cancelled=true;}} as Animation;};
  const stop=injectComposerInfo(f.document);
  const goal=f.document.querySelector('section[aria-label="Goal"]')!; const parent=goal.parentNode!;
  goal.remove(); await f.tick();
  const exit=exits[0]; assert.ok(exit,'exit is not limited to a loading Diff');
  assert.equal(exit.node.style.transformOrigin,'left center');
  assert.equal(exit.node.getAttribute('aria-hidden'),'true');
  assert.equal(exit.frames.at(-1)?.width,'0px');
  parent.appendChild(goal); await f.tick();
  assert.equal(exit.cancelled,true); assert.equal(exit.node.isConnected,false);
  stop();f.dom.window.close();
});

// Row and count updates share a flight while its overlay stays outside composer clipping.
test("queued arrivals survive row-first and count-first rendering without missing or repeating flights", async () => {
  const f=fixture(); f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showQueue":"상단 표시"}');
  const queue=f.document.querySelector('section[aria-label="Queued messages"]')!;
  queue.querySelector('header button')!.innerHTML='<span data-queued-messages-count>2</span>';
  const count=queue.querySelector('[data-queued-messages-count]')!; const rows=queue.querySelector('#queue')!;
  const add=(id:string)=>{const row=f.document.createElement('div');row.setAttribute('data-queued-message-id',id);rows.append(row);return row;};
  add('a'); const b=add('b');
  const drops:HTMLElement[]=[];
  f.dom.window.HTMLElement.prototype.animate=function(){if(this.classList.contains('bbk-drop')) drops.push(this);return {cancel(){}} as Animation;};
  const stop=injectComposerInfo(f.document);
  add('c'); await f.tick(); assert.equal(drops.length,1,'row-first arrivals are immediate');
  count.textContent='3'; await f.tick(); assert.equal(drops.length,1,'the later counter does not repeat the same arrival');
  count.textContent='4'; await f.tick(); assert.equal(drops.length,2);
  add('d'); await f.tick(); assert.equal(drops.length,2,'the later row does not repeat the count-first arrival');
  b.remove(); add('e'); count.textContent='3'; await f.tick(); assert.equal(drops.length,3,'an arrival concurrent with dispatch still flies');
  assert.equal((drops.at(-1)?.closest('[data-queue-liquid]') as HTMLElement)?.style.position,'fixed','flight escapes composer clipping and stacking');
  assert.equal(drops.at(-1)?.closest('[data-queue-liquid]')?.parentNode,f.document.body);
  stop();assert.equal(f.document.querySelector('.bbk-drop'),null);f.dom.window.close();
});

test("queue rerendering does not turn existing messages into extra droplets", async () => {
  const f=fixture(); f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings','{"showQueue":"상단 표시"}');
  const queue=f.document.querySelector('section[aria-label="Queued messages"]')!;
  queue.querySelector('header button')!.innerHTML='<span data-queued-messages-count>2</span>';
  const count=queue.querySelector('[data-queued-messages-count]')!; const rows=queue.querySelector('#queue')!;
  const add=(id:string)=>{const row=f.document.createElement('div');row.setAttribute('data-queued-message-id',id);rows.append(row);return row;};
  const a=add('a'); add('b');
  let flights=0;
  f.dom.window.HTMLElement.prototype.animate=function(){if(this.classList.contains('bbk-drop')) flights++;return {cancel(){}} as Animation;};
  const timeout=f.dom.window.setTimeout.bind(f.dom.window);
  let nextFlight:(()=>void)|null=null;
  f.dom.window.setTimeout=((callback:TimerHandler,delay?:number,...args:unknown[])=>{
    if(delay===45){assert.equal(typeof callback,'function');nextFlight=callback as ()=>void;return -45;}
    return timeout(callback,delay,...args);
  }) as typeof f.dom.window.setTimeout;
  const stop=injectComposerInfo(f.document);
  a.remove(); await f.tick();
  add('a'); add('c'); count.textContent='3'; await f.tick();
  assert.equal(flights,1,'restoring an existing row alongside one new send flies only once');
  rows.replaceChildren(); count.textContent='0'; await f.tick();
  add('a'); add('b'); add('c'); add('d'); count.textContent='4'; await f.tick();
  assert.equal(flights,2,'rebuilding all rows and the counter does not replay old messages');
  const parent=queue.parentNode!;
  queue.remove(); await f.tick(); parent.appendChild(queue); await f.tick();
  assert.equal(flights,2,'temporarily remounting the queue is not another send');
  add('e'); await f.tick(); assert.equal(flights,3,'a real row-first send still flies immediately');
  rows.querySelector('[data-queued-message-id="e"]')!.remove(); await f.tick();
  add('e'); count.textContent='5'; await f.tick();
  assert.equal(flights,3,'a rerender between the row and counter preserves their shared arrival');
  add('f'); add('g'); count.textContent='7'; await f.tick();
  assert.equal(flights,4,'the first of two sends leaves immediately');
  assert.ok(nextFlight,'the next flight is scheduled with a 45ms stagger');
  (nextFlight as ()=>void)();
  assert.equal(flights,5,'the second send follows 45ms later');
  stop();f.dom.window.close();
});

function markDevice(document: Document, device: "desktop" | "phone", extra: { viewport?: string; orientation?: string } = {}) {
  const marker = document.createElement("span");
  marker.hidden = true;
  marker.setAttribute("data-bb-chat-ui-device", device);
  if (extra.viewport) marker.setAttribute("data-bb-chat-ui-viewport", extra.viewport);
  if (extra.orientation) marker.setAttribute("data-bb-chat-ui-orientation", extra.orientation);
  document.body.append(marker);
  return marker;
}

function jumpFixture(settings: Record<string, unknown> = {}) {
  const f = fixture();
  f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings', JSON.stringify({showInactiveInfo:true,...settings}));
  const jump = f.document.createElement('button');
  jump.setAttribute('aria-label', 'Scroll to latest event'); jump.className = 'invisible';
  let jumps = 0; jump.addEventListener('click', () => jumps++);
  f.document.querySelector('.chat-prompt-box')!.append(jump);
  const stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  let width = 248;
  stack.getBoundingClientRect = () => ({ width } as DOMRect);
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true, get() { return this.hasAttribute('data-bb-chat-ui-info-trigger') ? 64 : 0; } });
  const shown = () => [...f.document.querySelectorAll<HTMLElement>('[data-bb-chat-ui-info-trigger]')].filter(button => !button.hidden).length;
  const folded = () => [...f.document.querySelectorAll<HTMLElement>('[data-bb-chat-ui-info-trigger]')].filter(button => button.hidden).length;
  return { ...f, jump, stack, jumps:() => jumps, setWidth:(next:number) => { width = next; }, shown, folded };
}

test("Latest stays on the right across devices, widths, rotation and stored choices", async () => {
  const phone = jumpFixture({ infoButtonLayout:"오른쪽 캡슐" });
  const phoneMarker = phone.document.createElement("span");
  phoneMarker.hidden = true;
  phoneMarker.setAttribute("data-bb-chat-ui-device", "phone");
  phoneMarker.setAttribute("data-bb-chat-ui-orientation", "landscape");
  phoneMarker.setAttribute("data-bb-chat-ui-viewport", "wide");
  phone.document.body.append(phoneMarker);
  const stopPhone = injectComposerInfo(phone.document);
  try {
    const layout = () => phone.document.querySelector("[data-bb-chat-ui-info-bar]")!.getAttribute("data-bb-chat-ui-info-layout");
    assert.equal(layout(), "dock", "a phone uses the right edge");
    for (const width of [240, 2000]) {
      phone.setWidth(width);
      phone.dom.window.dispatchEvent(new phone.dom.window.Event("resize"));
      await phone.tick();
      assert.equal(layout(), "dock", `phone width ${width} stays on the right`);
    }
    assert.equal(phone.jump.hasAttribute("data-bb-chat-ui-info-jump-source"), true);
  } finally { stopPhone(); }
  assert.equal(phone.jump.hasAttribute("data-bb-chat-ui-info-jump-source"), false, "phone cleanup releases the host button");
  phone.dom.window.close();

  const desktop = jumpFixture({ infoButtonLayout:"가운데 최신으로" });
  const stop = injectComposerInfo(desktop.document);
  try {
    const layout = () => desktop.document.querySelector("[data-bb-chat-ui-info-bar]")!.getAttribute("data-bb-chat-ui-info-layout");
    assert.equal(layout(), "dock", "the row stays on the right until a desktop marker exists");
    const marker = desktop.document.createElement("span");
    marker.hidden = true;
    marker.setAttribute("data-bb-chat-ui-device", "desktop");
    marker.setAttribute("data-bb-chat-ui-viewport", "narrow");
    marker.setAttribute("data-bb-chat-ui-orientation", "portrait");
    desktop.document.body.append(marker);
    await desktop.tick();
    assert.equal(layout(), "dock", "a late narrow desktop marker docks");
    desktop.setWidth(320);
    desktop.dom.window.dispatchEvent(new desktop.dom.window.Event("resize"));
    await desktop.tick();
    assert.equal(layout(), "dock", "a narrow desktop stays docked");
    marker.setAttribute("data-bb-chat-ui-device", "phone");
    marker.setAttribute("data-bb-chat-ui-orientation", "landscape");
    marker.setAttribute("data-bb-chat-ui-viewport", "wide");
    await desktop.tick();
    assert.equal(layout(), "dock", "a wide landscape phone stays on the right");
    marker.setAttribute("data-bb-chat-ui-device", "tablet");
    await desktop.tick();
    assert.equal(layout(), "dock", "tablet stays on the right");
    marker.setAttribute("data-bb-chat-ui-device", "desktop");
    await desktop.tick();
    assert.equal(layout(), "dock");
    assert.equal(desktop.jump.hasAttribute("data-bb-chat-ui-info-jump-source"), true);
    desktop.jump.classList.remove("invisible");
    await desktop.tick();
    desktop.document.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-jump]")!.click();
    assert.equal(desktop.jumps(), 1, "the docked control still forwards to the host button");
  } finally { stop(); }
  assert.equal(desktop.jump.hasAttribute("data-bb-chat-ui-info-jump-source"), false, "desktop cleanup releases the host button");
  desktop.dom.window.close();
});

test("a desktop row keeps an A tail and a separate Latest button at the right edge", async () => {
  const f=jumpFixture(); markDevice(f.document,'desktop',{viewport:'narrow'});
  const stop=injectComposerInfo(f.document);
  try {
    const bar=f.document.querySelector('[data-bb-chat-ui-info-bar]')!;
    const all=f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-all]')!;
    const proxy=f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-jump]')!;
    assert.equal(all.parentElement!.parentElement,bar);assert.equal(proxy.parentElement,bar);
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-dock]'),null);
    assert.notEqual(resolvedStyle(all.parentElement!).marginLeft,'auto');
    assert.equal(resolvedStyle(proxy).right,'0px');
    for(const pill of f.document.querySelectorAll('[data-bb-chat-ui-info-trigger]')) assert.ok(pill.compareDocumentPosition(all)&f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.equal(proxy.hasAttribute('data-bb-chat-ui-info-jump-off'),true);
    assert.equal(f.shown(),2,'the avatar stack reserves its four overlapping circles');
    assert.equal(all.querySelector('[data-bb-chat-ui-info-count]')!.textContent,`+${15-f.shown()-3}`);
    f.jump.classList.remove('invisible');await f.tick();
    assert.equal(proxy.hasAttribute('data-bb-chat-ui-info-jump-off'),false);
    assert.equal(f.shown(),1,'the standalone Latest reserves another 32px plus an 8px gap');
    proxy.click();assert.equal(f.jumps(),1);
    f.jump.classList.add('invisible');await f.tick();assert.equal(f.shown(),2);
    f.setWidth(2000);f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await f.tick();
    assert.equal(f.folded(),0);assert.equal(all.hidden,false,'inactive families remain in the overflow circle');
  } finally {stop();f.dom.window.close();}
});

test("a phone row keeps an A tail and reserves a separate Latest at the right edge", async () => {
  const f = jumpFixture({ infoButtonLayout:"오른쪽 캡슐" });
  const marker = markDevice(f.document, "phone", { viewport:"wide", orientation:"landscape" });
  const stop = injectComposerInfo(f.document);
  try {
    const bar = f.document.querySelector('[data-bb-chat-ui-info-bar]')!;
    assert.equal(bar.getAttribute('data-bb-chat-ui-info-layout'), 'dock');
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-dock]'), null);
    const all = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-all]')!;
    const proxy = f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-jump]')!;
    assert.equal(all.parentElement!.parentElement, bar); assert.equal(proxy.parentElement, bar);
    for (const pill of f.document.querySelectorAll('[data-bb-chat-ui-info-trigger]')) assert.ok(pill.compareDocumentPosition(all) & f.dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
    assert.deepEqual([...all.querySelectorAll('svg[data-bb-chat-ui-info-glyph] path')].map(path => path.getAttribute('d')), ['m12 3 9 5-9 5-9-5z', 'm3 13 9 5 9-5']);
    const glyph = all.querySelector('svg[data-bb-chat-ui-info-glyph]');
    assert.equal(proxy.querySelector('[data-bb-chat-ui-info-jump-label]')!.textContent, 'Latest');
    assert.deepEqual([...proxy.querySelectorAll('svg path')].map(path => path.getAttribute('d')), ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'], 'the chip points down to a bottom line');
    assert.equal(proxy.hasAttribute('data-bb-chat-ui-info-jump-off'), true);
    assert.equal(f.shown(), 2, 'a folded count widens the button by 8px before fitting');
    assert.equal(all.hidden,false);
    assert.equal(all.querySelector('[data-bb-chat-ui-info-count]')!.textContent, `+${15-f.shown()-3}`);
    f.jump.classList.remove('invisible'); await f.tick();
    assert.equal(proxy.hasAttribute('data-bb-chat-ui-info-jump-off'), false);
    assert.equal(f.shown(), 1, 'Latest reserves 32px plus an 8px gap on a phone');
    assert.equal(resolvedStyle(proxy).right,'0px');
    assert.equal(resolvedStyle(proxy.querySelector('[data-bb-chat-ui-info-jump-label]')!).display,'none');
    f.click('[data-bb-chat-ui-info-all]');
    assert.equal(proxy.hasAttribute('data-bb-chat-ui-info-jump-off'), false, 'the right-edge button stays usable with a popover open');
    f.click('[data-bb-chat-ui-info-all]');
    assert.equal(proxy.hasAttribute('data-bb-chat-ui-info-jump-off'), false);
    proxy.click(); assert.equal(f.jumps(), 1);
    f.setWidth(2000); f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick();
    assert.equal(all.hidden,false,'empty information still occupies the icon stack');
    marker.setAttribute("data-bb-chat-ui-device", "desktop");
    marker.setAttribute("data-bb-chat-ui-viewport", "narrow");
    await f.tick();
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-dock]'),null,'changing device never merges the independent tail');
    assert.equal(all.querySelector('svg[data-bb-chat-ui-info-glyph]'), glyph, 'switching layouts keeps one icon');
    assert.equal(all.parentElement!.parentElement, bar); assert.equal(proxy.parentElement, bar);
    assert.equal(bar.getAttribute('data-bb-chat-ui-info-layout'), 'dock');
    marker.setAttribute("data-bb-chat-ui-device", "phone");
    await f.tick();
    assert.equal(all.parentElement!.parentElement, bar);
    assert.equal(f.document.querySelector('[data-bb-chat-ui-info-dock]'), null);
  } finally { stop(); f.dom.window.close(); }
});

test("read-only rows and input requests leave the host latest-event button unmanaged", async () => {
  const f = jumpFixture();
  markDevice(f.document, "desktop", { viewport:"narrow" });
  const stop = injectComposerInfo(f.document);
  try {
    assert.ok(f.jump.hasAttribute('data-bb-chat-ui-info-jump-source'));
    f.document.querySelector('.space-y-2')!.insertAdjacentHTML('beforeend', '<section aria-label="Thread history"><div aria-label="Archived thread"></div></section>');
    await f.tick();
    assert.equal(f.jump.hasAttribute('data-bb-chat-ui-info-jump-source'), false, 'the full-width state does not hide the host scroll button');
    assert.equal(f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-all]')!.hidden, true);
  } finally { stop(); f.dom.window.close(); }
});

test("the Child Thread stack shows three, two or one latest avatars by the room left, with an exact overflow count", async () => {
  const f = jumpFixture();
  markDevice(f.document, "desktop");
  const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  const children = Array.from({ length:7 }, (_, index) => ({ id:`child-${index}`, title:`Review ${index}`, state:'run' }));
  let count = 6;
  const publish = () => source.setAttribute('data-bb-chat-ui-info-children', JSON.stringify(children.slice(0, count)));
  publish();
  // 30px circles overlap by 12px; the children pill has no extra gutter and the Diff pill is 140px.
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true, get() {
    const key = this.getAttribute('data-bb-chat-ui-info-trigger');
    if (key === 'children') return 30 + 18 * (this.querySelectorAll('[data-bb-chat-ui-info-avatar], [data-bb-chat-ui-info-avatar-more]').length - 1);
    return key === 'diff' ? 140 : key ? 64 : 0;
  } });
  const stop = injectComposerInfo(f.document);
  const pill = () => f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="children"]')!;
  const shown = () => [...pill().querySelectorAll('[data-bb-chat-ui-info-avatar]')].map(node => node.getAttribute('data-child'));
  const more = () => pill().querySelector('[data-bb-chat-ui-info-avatar-more]')?.textContent ?? null;
  const resize = async (width:number) => { f.setWidth(width); f.dom.window.dispatchEvent(new f.dom.window.Event('resize')); await f.tick(); };
  try {
    await resize(400);
    assert.deepEqual(shown(), ['child-3','child-4','child-5']); assert.equal(more(), '+3');
    await resize(320);
    assert.deepEqual(shown(), ['child-4','child-5'], 'a narrower row keeps the two latest avatars');
    assert.equal(more(), '+4'); assert.equal(pill().hidden, false);
    await resize(303);
    assert.deepEqual(shown(), ['child-5']); assert.equal(more(), '+5');
    assert.equal(f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="diff"]')!.hidden, false, 'Code Diff stays beside the shortened stack');
    assert.match(pill().getAttribute('aria-label') ?? '', /6개/, 'the label keeps the full child count');
    count = 7; publish(); await f.tick();
    assert.deepEqual(shown(), ['child-6']); assert.equal(more(), '+6', 'new data keeps the current room limit');
    await resize(337);
    assert.equal(shown().length, 3, 'room returns all three before Latest appears');
    f.jump.classList.remove('invisible'); await f.tick();
    assert.deepEqual(shown(), ['child-6'], 'the standalone Latest takes room from the stack first');
    assert.equal(more(), '+6');
    f.jump.classList.add('invisible'); await f.tick();
    assert.equal(shown().length, 3); assert.equal(more(), '+4');
    count = 2; publish(); await resize(303);
    assert.deepEqual(shown(), ['child-0','child-1'], 'two faces take the same room as one face and +1');
    assert.equal(more(), null, 'no overflow circle when every child is shown');
    await resize(140);
    assert.equal(pill().hidden, true, 'without room even for one avatar the stack folds into the menu');
  } finally { stop(); f.dom.window.close(); }
});

test("pressing a pill squashes and pops it without moving its neighbours", async () => {
  for (const device of ["desktop", "phone"] as const) for (const reduced of [false, true]) {
    const f = jumpFixture();
    markDevice(f.document, device, device === "desktop" ? { viewport:"narrow" } : { viewport:"wide", orientation:"landscape" });
    f.setWidth(2000);
    Object.defineProperty(f.dom.window, 'matchMedia', { value:() => ({ matches:reduced }) });
    const records: { node:Element; frames:Keyframe[]; options:KeyframeAnimationOptions; animation:Animation; cancelled:boolean }[] = [];
    const animate = stubAnimations(f.dom.window);
    f.dom.window.HTMLElement.prototype.animate = function(frames, options) {
      const record = animate.call(this, frames, options);
      records.push(record);
      return record.animation;
    };
    const stop = injectComposerInfo(f.document);
    try {
      const presses = () => records.filter(record => record.options.duration === 120 || record.options.duration === 380);
      const point = (node:Element, type:string) => node.dispatchEvent(new f.dom.window.MouseEvent(type, { bubbles:true }));
      const goal = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="goal"]')!;
      records.length = 0;
      goal.click();
      assert.ok(f.document.querySelector('[data-bb-chat-ui-info-open]'), 'the popover still opens from the click');
      assert.equal(presses().length, 0, 'the click itself does not add a second press');
      point(goal, 'pointerdown');
      if (reduced) { assert.equal(presses().length, 0, `${device}: reduced motion skips the press`); continue; }
      assert.equal(presses().length, 1, `${device}: holding plays the squash`);
      assert.equal(presses()[0].node, goal);
      assert.deepEqual(presses()[0].frames.map(frame => frame.transform), ['scale(1)', 'scale(.9)']);
      assert.equal(presses()[0].options.duration, 120);
      assert.equal(presses()[0].options.fill, 'forwards');
      point(goal, 'pointerup');
      assert.equal(presses().length, 2, `${device}: release plays the pop`);
      assert.equal(presses()[0].cancelled, true, 'release replaces the held squash');
      assert.deepEqual(presses()[1].frames.map(frame => frame.transform), ['scale(.9)', 'scale(1.1)', 'scale(.97)', 'scale(1)']);
      assert.equal(presses()[1].options.duration, 380);
      assert.ok(presses().every(record => record.frames.every(frame => Object.keys(frame).every(key => ['transform', 'offset', 'easing'].includes(key)))), 'only transform moves');
      assert.ok(records.every(record => record.node === goal || !record.node.matches('[data-bb-chat-ui-info-trigger]')), 'neighbouring pills do not animate');
      point(goal, 'pointerdown');
      assert.equal(presses()[1].cancelled, true, 'a new press cancels the previous pop');
      point(goal, 'pointercancel');
      assert.equal(presses().at(-1)!.cancelled, true, 'cancel releases the held squash');
      assert.equal(presses().filter(record => record.options.duration === 380).length, 1, 'cancel does not play another pop');
      const key = (type:string, repeat = false) => {
        const event = new f.dom.window.KeyboardEvent(type, { key:'Enter', bubbles:true });
        Object.defineProperty(event, 'repeat', { value:repeat });
        goal.dispatchEvent(event);
      };
      key('keydown'); key('keydown', true); key('keyup');
      assert.equal(presses().filter(record => record.options.duration === 120).length, 3, 'keyboard press squashes once and ignores repeat');
      assert.equal(presses().filter(record => record.options.duration === 380).length, 2);
      point(goal, 'pointerdown');
      f.document.body.dispatchEvent(new f.dom.window.MouseEvent('pointerup', { bubbles:true }));
      assert.equal(presses().at(-1)!.options.duration, 380, `${device}: releasing outside the bar still pops`);
      assert.equal(presses().at(-2)!.cancelled, true, `${device}: the held squash does not stick after an outside release`);
      point(goal, 'pointerdown');
      f.dom.window.dispatchEvent(new f.dom.window.Event('blur'));
      assert.equal(presses().at(-1)!.cancelled, true, `${device}: a window blur cancels the held squash`);
      assert.equal(presses().filter(record => record.options.duration === 380).length, 3, `${device}: blur does not play a pop`);
      const beforeDisabled = presses().filter(record => record.options.duration === 120).length;
      goal.disabled = true;
      point(goal, 'pointerdown');
      assert.equal(presses().filter(record => record.options.duration === 120).length, beforeDisabled, 'a disabled pill does not squash');
      goal.disabled = false;
      point(goal, 'pointerdown');
      const removed = presses().at(-1)!;
      goal.remove();
      await f.tick();
      assert.equal(removed.cancelled, true, `${device}: removing the pill cancels its held press`);
      const all = f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-all]')!;
      point(all, 'pointerdown');
      const slot = all;
      assert.equal(presses().at(-1)!.node, slot, 'the all-information control presses as one visible object');
      stop();
      assert.ok(presses().every(record => record.cancelled), 'unload cancels presses');
    } finally { stop(); f.dom.window.close(); }
  }
});

test("right-edge Latest keeps its eased entrance and exit", () => {
  const rule = (selector:string) => composerInfoCss.split('\n').find(line => line.startsWith(`${selector} {`)) ?? '';
  const timing = (css:string, property:string) => {
    const match = css.match(new RegExp(`${property} (\\d+)ms(?: (?:[a-z-]+\\([^)]*\\)|[a-z-]+))?(?: (\\d+)ms)?`));
    return { duration:Number(match?.[1] ?? 0), delay:Number(match?.[2] ?? 0) };
  };
  const end = (css:string) => Math.max(...['width','opacity','translate','scale'].map(property => { const t = timing(css, property); return t.duration + t.delay; }));
  const dock = '[data-bb-chat-ui-info-bar][data-bb-chat-ui-info-layout="dock"] > [data-bb-chat-ui-info-jump]';
  for(const property of ['translate','scale']) assert.ok(timing(rule(dock),property).duration>=400,'the standalone right Latest keeps its eased entrance');
  assert.match(rule(`${dock}[data-bb-chat-ui-info-jump-off]`),/scale:\.92/,'Latest shrinks gently on exit');
  for (const selector of [dock]) {
    const hidden = rule(`${selector}[data-bb-chat-ui-info-jump-off]`);
    const visibility = Number(hidden.match(/visibility 0s (\d+)ms/)?.[1] ?? 0);
    assert.ok(visibility >= end(hidden), `${selector}: it stays visible until the exit finishes`);
    assert.doesNotMatch(rule(selector) + hidden, /cubic-bezier\(\.2,\.9,\.22,1\.25\)/, 'no springy overshoot on appear or leave');
  }
});

test("latest-event stays rendered while off so the host hidden rule cannot cancel its transition", async () => {
  for (const device of ["phone", "desktop"] as const) {
    const f = jumpFixture();
    markDevice(f.document, device);
    const host = f.document.createElement('style');
    host.textContent = '[hidden]{display:none!important}';
    f.document.head.append(host);
    const stop = injectComposerInfo(f.document);
    try {
      const proxy = f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-jump]')!;
      for (const visible of [false, true, false]) {
        f.jump.classList.toggle('invisible', !visible); await f.tick();
        assert.equal(proxy.hidden, false, `${device}: the hidden attribute would force display:none in BB`);
        assert.equal(proxy.hasAttribute('data-bb-chat-ui-info-jump-off'), !visible);
        assert.notEqual(resolvedStyle(proxy).display, 'none', `${device}: the element stays rendered to animate`);
        assert.equal(resolvedStyle(proxy).pointerEvents, visible ? 'auto' : 'none');
      }
    } finally { stop(); f.dom.window.close(); }
  }
});

test("Parent and PR popovers from the shared context card hide the other families' toggles", async () => {
  const f = fixture();
  const node = f.document.querySelector<HTMLElement>('section[aria-label="Thread context before sending"]')!;
  node.innerHTML = '<div class="flex items-center gap-0.5 p-1"><button id="thread-prompt-banner-parent-thread-toggle" aria-label="Parent thread: VAU-2" aria-expanded="false" aria-controls="thread-prompt-banner-parent-thread-body"><svg /></button><button id="thread-prompt-banner-git-toggle">+162 −21 · 6 files</button><a aria-label="Pull request 12: Open" href="https://example.com/pr/12">#12</a></div><div id="thread-prompt-banner-parent-thread-body" hidden><div class="overflow-hidden"><div class="px-3">This thread is a child of <a href="/threads/vau-2">VAU-2</a>.</div></div></div>';
  const toggle = node.querySelector<HTMLButtonElement>('#thread-prompt-banner-parent-thread-toggle')!;
  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    node.querySelector<HTMLElement>('#thread-prompt-banner-parent-thread-body')!.hidden = !expanded;
  });
  const shown = (selector:string) => resolvedStyle(node.querySelector(selector)!).display !== 'none';
  const stop = injectComposerInfo(f.document);
  try {
    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    assert.equal(shown('#thread-prompt-banner-git-toggle'), false, 'Parent does not show the Diff summary beside its title');
    assert.equal(shown('[aria-label^="Pull request "]'), false);
    assert.equal(shown('#thread-prompt-banner-parent-thread-toggle'), false, 'the native parent icon is not a second title');
    assert.equal(node.querySelector<HTMLElement>('#thread-prompt-banner-parent-thread-body')!.hidden, false);
    f.click('[data-bb-chat-ui-info-native-dismiss]'); await f.tick();
    assert.equal(shown('#thread-prompt-banner-git-toggle'), true, 'closing restores the native card');
    f.click('[data-bb-chat-ui-info-trigger="pullRequest"]'); await f.tick();
    assert.equal(shown('[aria-label^="Pull request "]'), true);
    assert.equal(shown('#thread-prompt-banner-git-toggle'), false);
    assert.equal(shown('#thread-prompt-banner-parent-thread-toggle'), false);
    assert.equal(shown('#thread-prompt-banner-parent-thread-body'), false, 'PR does not reveal the parent body');
  } finally { stop(); f.dom.window.close(); }
});

test("Parent popover hides the native sentence, person icon, and Diff without moving the card", async () => {
  const f = fixture();
  const utilities = f.document.createElement("style");
  utilities.textContent = ".border-t { border-top-width:1px; border-top-style:solid; } .border-border { border-top-color:rgb(228, 228, 231); } .border-transparent { border-top-color:transparent; } .bg-popover { background-color:rgb(255, 255, 255); } .dark .bg-popover { background-color:rgb(24, 24, 27); }";
  f.document.head.append(utilities);
  const source = f.document.querySelector("[data-bb-chat-ui-info-settings]")!;
  source.insertAdjacentHTML("beforeend", '<span data-bb-chat-ui-info-icon="parent"><svg data-family="parent"></svg></span>');
  const card = f.document.querySelector<HTMLElement>('section[aria-label="Thread context before sending"]')!;
  const sectionParent = card.parentElement;
  const shared = (summary: string) => `<div class="flex items-center gap-0.5 text-xs p-1"><button type="button" id="thread-prompt-banner-parent-thread-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-parent-thread-body" aria-label="Parent thread VAU-2 · 그래프 ㄱ자 코너 리사이즈 핸들"><svg data-icon="UserRound" aria-hidden="true"></svg></button><a href="https://example.com/pr/12" aria-label="Pull request 12: Open"><span>PR #12</span></a><button type="button" id="thread-prompt-banner-git-toggle" aria-expanded="false" aria-controls="thread-prompt-banner-git-body" aria-label="Changed files: Uncommitted, ${summary}"><span>${summary}</span></button></div><section id="thread-prompt-banner-parent-thread-body" role="region" aria-hidden="true" class="grid overflow-hidden pointer-events-none grid-rows-[0fr] opacity-0 border-t border-transparent"><div class="overflow-hidden bg-popover"><div class="px-3 pb-2 pt-1.5">This thread is a child of <a href="/threads/vau-2"><span>VAU-2 · 그래프 ㄱ자 코너 리사이즈 핸들</span></a>.</div><div class="px-1 pb-1"><button type="button" aria-expanded="true" aria-controls="thread-prompt-banner-parent-thread-body" aria-label="Collapse parent thread">Collapse</button></div></div></section><section id="thread-prompt-banner-git-body" role="region" aria-hidden="true" class="grid overflow-hidden border-t border-transparent"><div class="overflow-hidden bg-popover"><div class="px-3">lib/composer-info.ts</div></div></section>`;
  const alone = `<div class="flex items-center gap-0.5 text-xs p-1"><div class="flex min-w-0 items-center gap-1.5 text-xs" title="Parent thread Chat UI 전체 이슈 정리"><svg data-icon="UserRound" aria-hidden="true"></svg><span class="min-w-0 truncate">Parent <a href="/threads/parent-only"><span>Chat UI 전체 이슈 정리</span></a></span></div></div>`;
  const wire = () => {
    for (const toggle of card.querySelectorAll<HTMLButtonElement>('button[id$="-toggle"]')) {
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(expanded));
        const body = card.querySelector<HTMLElement>(`#${toggle.getAttribute("aria-controls")}`);
        if (!body) return;
        body.setAttribute("aria-hidden", String(!expanded));
        body.className = expanded
          ? "grid overflow-hidden grid-rows-[1fr] border-t border-border opacity-100"
          : "grid overflow-hidden pointer-events-none grid-rows-[0fr] opacity-0 border-t border-transparent";
      });
    }
  };
  card.innerHTML = shared("Uncommitted · +162 −21 · 6 files");
  wire();
  const style = (node: Element) => resolvedStyle(node);
  const stop = injectComposerInfo(f.document);
  try {
    const link = () => card.querySelector<HTMLAnchorElement>('#thread-prompt-banner-parent-thread-body a')!;
    const linkParent = link().parentElement;
    let navigated = 0;
    link().addEventListener("click", event => { event.preventDefault(); navigated++; });
    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    const toggle = card.querySelector<HTMLButtonElement>("#thread-prompt-banner-parent-thread-toggle")!;
    const body = card.querySelector<HTMLElement>("#thread-prompt-banner-parent-thread-body")!;
    assert.equal(style(toggle).display, "none", "the native person-icon toggle is not a second Parent title");
    assert.equal(style(toggle.parentElement!).display, "none", "the shared segment row does not stay under the title");
    assert.equal(style(card.querySelector("#thread-prompt-banner-git-toggle")!).display, "none");
    assert.equal(style(card.querySelector("#thread-prompt-banner-git-body")!).display, "none");
    assert.equal(style(card.querySelector('a[aria-label^="Pull request "]')!).display, "none");
    assert.equal(style(body).display, "none", "the relationship sentence stays out of the popover");
    const waiting = card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-row]");
    assert.equal(card.querySelector("[data-bb-chat-ui-card-head]"), null, "Parent stays a single navigation row");
    assert.equal(waiting?.textContent, "VAU-2 · 그래프 ㄱ자 코너 리사이즈 핸들");
    assert.equal(waiting?.querySelector("[data-provider], [data-family], [data-icon='UserRound']"), null);
    assert.match(body.textContent ?? "", /This thread is a child of/);
    assert.match(body.textContent ?? "", /VAU-2/);
    assert.equal((body.textContent ?? "").includes("+162"), false);
    assert.equal((body.textContent ?? "").includes("lib/composer-info.ts"), false);
    assert.equal(card.querySelectorAll("[data-bb-chat-ui-info-native-dismiss]").length, 1);
    assert.equal(style(card.querySelector('[aria-label="Collapse parent thread"]')!.parentElement!).display, "none");
    assert.equal(link().parentElement, linkParent);
    link().click();
    assert.equal(navigated, 1);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(card.querySelector("#thread-prompt-banner-git-toggle")!.getAttribute("aria-expanded"), "false");

    card.querySelector("#thread-prompt-banner-git-toggle span")!.textContent = "Uncommitted · +200 −1 · 2 files";
    await f.tick();
    assert.equal(style(card.querySelector("#thread-prompt-banner-git-toggle")!).display, "none");
    assert.equal(style(body).display, "none");
    assert.ok(f.document.querySelector('[data-bb-chat-ui-info-trigger="diff"]')?.textContent?.includes("+200"));
    f.document.documentElement.classList.add("dark");
    assert.equal(style(body).display, "none", "dark mode keeps the relationship sentence out");
    f.document.documentElement.classList.remove("dark");

    card.innerHTML = shared("Uncommitted · +200 −1 · 2 files");
    wire();
    await f.tick();
    const nextToggle = card.querySelector<HTMLButtonElement>("#thread-prompt-banner-parent-thread-toggle")!;
    const nextBody = card.querySelector<HTMLElement>("#thread-prompt-banner-parent-thread-body")!;
    assert.equal(nextToggle.getAttribute("aria-expanded"), "true", "a native rerender keeps the parent disclosure open");
    assert.equal(style(nextToggle).display, "none");
    assert.equal(style(nextBody).display, "none");
    assert.match(nextBody.textContent ?? "", /This thread is a child of/);
    assert.equal(card.parentElement, sectionParent);

    f.click('[data-bb-chat-ui-info-native-dismiss]');
    assert.equal(card.hasAttribute("data-bb-chat-ui-info-open"), false);
    assert.notEqual(style(card.querySelector("#thread-prompt-banner-parent-thread-toggle")!).display, "none", "closing restores the native icon row");
    assert.equal(style(card.querySelector(".bg-popover")!).backgroundColor, "rgb(255, 255, 255)");
    assert.equal(card.querySelector("#thread-prompt-banner-parent-thread-toggle")!.getAttribute("aria-expanded"), "false");

    card.innerHTML = alone;
    await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="parent"]'); await f.tick();
    const inlineLink = card.querySelector<HTMLAnchorElement>('a[href="/threads/parent-only"]')!;
    const inlineParent = inlineLink.parentElement!;
    assert.equal(style(card.querySelector("svg[data-icon='UserRound']")!).display, "none", "parent-only does not repeat the native person icon");
    assert.equal(style(inlineParent).display, "none", "parent-only does not repeat the native Parent verb");
    assert.equal(style(inlineLink).display, "none");
    assert.equal(inlineLink.parentElement, inlineParent);
    const nativeRow = card.querySelector<HTMLButtonElement>("[data-bb-chat-ui-info-parent-row]");
    assert.equal(card.querySelector("[data-bb-chat-ui-card-head]"), null, "Parent stays a single navigation row");
    assert.equal(nativeRow?.textContent, "Chat UI 전체 이슈 정리");
    assert.equal(nativeRow?.querySelector("[data-provider], [data-family], [data-icon='UserRound']"), null);
    assert.equal(card.querySelectorAll("[data-bb-chat-ui-info-native-dismiss]").length, 1);
    f.click('[data-bb-chat-ui-info-native-dismiss]');
    assert.equal(card.querySelector("[data-bb-chat-ui-info-close-heading]"), null);
    assert.equal(card.innerHTML, alone);
    stop();
    assert.equal(card.innerHTML, alone);
    assert.equal(card.parentElement, sectionParent);
  } finally { stop(); f.dom.window.close(); }
});



test('information circles open their own details and disabled families disappear from the stack',async()=>{
 const f=fixture();const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
 source.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({showInactiveInfo:true,...Object.fromEntries(infoKinds.map(k=>['show'+k.key[0].toUpperCase()+k.key.slice(1),'목록에만 표시']))}));
 const stop=injectComposerInfo(f.document);
 try {
  const circles=()=>[...f.document.querySelectorAll('[data-bb-chat-ui-info-stack-kind]')];
  assert.equal(circles().length,3,'active and empty families share three icon slots');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-count]')!.textContent,'+12');
  const key=circles()[0].getAttribute('data-bb-chat-ui-info-stack-kind')!;
  (circles()[0] as HTMLButtonElement).click();
  assert.ok(f.document.querySelector(`[data-bb-chat-ui-info-open="${key}"]`)||f.document.querySelector('[data-bb-chat-ui-info-menu]'),'a circle opens that family directly');
  const settings=JSON.parse(source.getAttribute('data-bb-chat-ui-info-settings')!);settings['show'+key[0].toUpperCase()+key.slice(1)]='끄기';source.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify(settings));await f.tick();
  assert.equal(f.document.querySelector(`[data-bb-chat-ui-info-stack-kind="${key}"]`),null);
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-count]')!.textContent,'+11');
 } finally {stop();f.dom.window.close();}
});

 test('content pills size themselves and the child stack adds no extra right gutter',()=>{
  const f=fixture(),stop=injectComposerInfo(f.document);
  try{
   for(const node of f.document.querySelectorAll('[data-bb-chat-ui-info-trigger]')){
    const style=resolvedStyle(node);
    assert.equal(style.width,'auto','text pills do not reserve a fixed width');
    assert.equal(style.minWidth,'0px','content can yield to the available row width');
   }
   assert.equal(resolvedStyle(f.document.querySelector('[data-bb-chat-ui-info-trigger="children"]')!).paddingRight,'0px');
   assert.equal(resolvedStyle(f.document.querySelector('[data-bb-chat-ui-info-bar]')!).gap,'8px');
   assert.equal(resolvedStyle(f.document.querySelector('[data-bb-chat-ui-info-stack-icons]')!).position,'relative','circle offsets start at the stack, not a distant row ancestor');
  }finally{stop();f.dom.window.close();}
 });

 test('the tail fans out from its last circle after sequential pill entrances',async()=>{
 for(const reduced of [false,true]) for(const more of [false,true]){
  const f=fixture();
  Object.defineProperty(f.dom.window,'matchMedia',{value:()=>({matches:reduced})});
  if(!more) f.document.querySelector('[data-bb-chat-ui-info-settings]')!.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({showInactiveInfo:true,...Object.fromEntries(infoKinds.map(k=>[k.setting,['goal','plan','machine'].includes(k.key)?'상단 표시':'끄기']))}));
  Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetLeft',{get(){return this.parentElement?.hasAttribute('data-bb-chat-ui-info-stack-icons') ? Array.from(this.parentElement.children).indexOf(this)*18 : 0;}});
  const records:ReturnType<ReturnType<typeof stubAnimations>>[]=[];const animate=stubAnimations(f.dom.window);
  f.dom.window.HTMLElement.prototype.animate=function(frames,options){const r=animate.call(this,frames,options);records.push(r);return r.animation;};
  const stop=injectComposerInfo(f.document);
  try{
   const group=f.document.querySelector('[data-bb-chat-ui-info-stack-icons]')!;
   const circles=Array.from(group.children).filter(n=>!(n as HTMLElement).hidden);
   const anchor=circles.at(-1)!;
   const anchorEntry=records.find(r=>r.node===anchor&&r.options.duration===460);
   const fans=()=>records.filter(r=>r.node.parentElement===group&&r.options.duration===280&&r.frames[0].opacity===0);
   if(reduced){assert.equal(anchorEntry,undefined);assert.equal(fans().length,0);continue;}
   assert.ok(anchorEntry,'the +N or last icon enters after the pills');
   assert.equal(records.some(r=>r.node===group&&r.options.duration===460),false,'the whole expanded stack does not bounce together');
   const lastPillStart=Math.max(0,...records.filter(r=>r.node.hasAttribute('data-bb-chat-ui-info-trigger')&&r.options.duration===460).map(r=>Number(r.options.delay)));
   assert.ok(Number(anchorEntry.options.delay)>lastPillStart);
   assert.equal(fans().length,circles.length-1);
   const start=Number(anchorEntry.options.delay)+460;
   for(const [i,node]of circles.slice(0,-1).entries()){
    const fan=fans().find(r=>r.node===node)!;
    assert.deepEqual(fan.frames.map(k=>k.translate),[`${-i*18}px 0`,'0px 0']);
    assert.deepEqual(fan.frames.map(k=>k.opacity),[0,1]);
    assert.equal(fan.options.delay,start+i*45,'icons open left to right and push the last circle');
    assert.equal(fan.options.fill,'backwards');
   }
   const push=records.find(r=>r.node===anchor&&r.frames[0].translate!==undefined)!;
   assert.ok(push,'the +N starts at the left edge and is pushed right');
   assert.deepEqual(push.frames.map(k=>k.translate),[`${-(circles.length-1)*18}px 0`,'0px 0']);
   assert.equal(push.options.delay,start);
   const growth=records.find(r=>r.node===group&&r.frames[0].width)!;
   assert.ok(growth,'the stack grows from one circle instead of occupying its final width immediately');
   assert.deepEqual(growth.frames.map(k=>k.width),['32px',`${32+(circles.length-1)*18}px`]);
   assert.equal(growth.options.delay,start);
   const count=fans().length;await f.tick();f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await f.tick();
   assert.equal(fans().length,count,'routine updates do not fan the stack out again');
   stop();assert.ok(fans().every(r=>r.cancelled),'unload cancels delayed fan animations');
  }finally{stop();f.dom.window.close();}
 }
 });

test('the initial +N count includes icons until each one starts unfolding',async()=>{
 const f=fixture(),source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
 source.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({showInactiveInfo:true,...Object.fromEntries(infoKinds.map(k=>[k.setting,['diff','children'].includes(k.key)?'상단 표시':'목록에만 표시']))}));
 const records:ReturnType<ReturnType<typeof stubAnimations>>[]=[];const animate=stubAnimations(f.dom.window);
 f.dom.window.HTMLElement.prototype.animate=function(frames,options){const r=animate.call(this,frames,options);records.push(r);return r.animation;};
 const timers=new Map<number,{fn:()=>void;delay:number}>();let serial=0;
 f.dom.window.setTimeout=((fn:()=>void,delay:number)=>{const id=++serial;timers.set(id,{fn,delay});return id;}) as typeof f.dom.window.setTimeout;
 f.dom.window.clearTimeout=(id:number)=>{timers.delete(id);};
 const stop=injectComposerInfo(f.document);
 try{
  const count=()=>f.document.querySelector('[data-bb-chat-ui-info-count]')!.textContent;
  assert.equal(count(),'+13','one collapsed circle initially represents all thirteen hidden families');
  f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(count(),'+13','routine fitting must not jump to the final count');
  const fans=records.filter(r=>r.node.hasAttribute('data-bb-chat-ui-info-stack-kind')&&r.options.duration===280&&r.frames[0].opacity===0);
  const delays=fans.map(r=>Number(r.options.delay));assert.equal(delays.length,3);
  const steps=delays.map(delay=>[...timers.entries()].find(([,timer])=>timer.delay===delay));
  assert.ok(steps.every(Boolean),'count steps follow the three fan starts');
  for(const [index,step]of steps.entries()){
   const [id,timer]=step!;timers.delete(id);timer.fn();
   assert.equal(count(),`+${12-index}`);
   assert.match(f.document.querySelector('[data-bb-chat-ui-info-all]')!.getAttribute('aria-label')!,new RegExp(`더 보기 ${12-index}개`));
  }
  f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(count(),'+10','later layout passes retain the actual remainder');
 }finally{stop();assert.equal(timers.size,0,'unload clears deferred count updates');f.dom.window.close();}
});


test('unfinished stack count steps stop on unload and reduced motion',async()=>{
 for(const action of ['unload','reduce']){
  const f=fixture();let reduced=false;
  Object.defineProperty(f.dom.window,'matchMedia',{value:()=>({matches:reduced})});
  const animate=stubAnimations(f.dom.window);
  f.dom.window.HTMLElement.prototype.animate=function(frames,options){return animate.call(this,frames,options).animation;};
  const timers=new Map<number,()=>void>();let serial=0;
  f.dom.window.setTimeout=((fn:()=>void)=>{const id=++serial;timers.set(id,fn);return id;}) as typeof f.dom.window.setTimeout;
  f.dom.window.clearTimeout=(id:number)=>{timers.delete(id);};
  const stop=injectComposerInfo(f.document);
  try{
   assert.equal(timers.size,3,'the initial count has three deferred icon steps');
   if(action==='unload')stop();
   else{reduced=true;f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await new Promise(resolve=>setTimeout(resolve,40));}
   assert.equal(timers.size,0,'no deferred count changes survive cancellation');
  }finally{stop();f.dom.window.close();}
 }
});

test('late cancellation of a previous thread fan cannot finish the new count steps',async()=>{
 const f=fixture(),source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
 source.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify({showInactiveInfo:true,...Object.fromEntries(infoKinds.map(k=>[k.setting,['diff','children'].includes(k.key)?'상단 표시':'목록에만 표시']))}));
 const late:(()=>void)[]=[];const animate=stubAnimations(f.dom.window);
 f.dom.window.HTMLElement.prototype.animate=function(frames,options){const r=animate.call(this,frames,options);r.animation.cancel=()=>{r.cancelled=true;const handler=r.animation.oncancel;if(handler)late.push(()=>handler.call(r.animation,new f.dom.window.Event('cancel') as AnimationPlaybackEvent));};return r.animation;};
 const timers=new Map<number,()=>void>();let serial=0;
 f.dom.window.setTimeout=((fn:()=>void)=>{const id=++serial;timers.set(id,fn);return id;}) as typeof f.dom.window.setTimeout;
 f.dom.window.clearTimeout=(id:number)=>{timers.delete(id);};
 const stop=injectComposerInfo(f.document);
 try{
  source.setAttribute('data-bb-chat-ui-info-thread','new-count-thread');await new Promise(resolve=>setTimeout(resolve,40));
  assert.equal(timers.size,3);assert.equal(f.document.querySelector('[data-bb-chat-ui-info-count]')!.textContent,'+13');
  assert.ok(late.length,'WAAPI cancellation events may arrive after the new fan is scheduled');
  for(const callback of late.splice(0))callback();
  assert.equal(timers.size,3,'old animation callbacks must leave the new timers intact');
  assert.equal(f.document.querySelector('[data-bb-chat-ui-info-count]')!.textContent,'+13');
 }finally{stop();f.dom.window.close();}
});

test('request guards are marked in the mutation checkpoint without waiting for a layout frame',async()=>{
 const f=fixture();let frame=0;
 f.dom.window.requestAnimationFrame=()=>++frame;f.dom.window.cancelAnimationFrame=()=>{};
 const stop=injectComposerInfo(f.document);
 try{
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  assert.ok(stack.hasAttribute('data-bb-chat-ui-info-guard'));
  const host=f.document.createElement('section');host.innerHTML='<div data-testid="approval-banner"><button>Approve</button></div>';stack.append(host);
  await Promise.resolve();await Promise.resolve();
  assert.ok(host.hasAttribute('data-bb-chat-ui-info-holds-request'));
  assert.notEqual(resolvedStyle(host).display,'none');
  const shell=f.document.createElement('div');shell.setAttribute('data-promptbox-shell','');
  shell.innerHTML='<div class="grid"><span hidden data-bb-chat-ui-info-settings="{}"></span><section>New card</section></div>';
  f.document.body.append(shell);await Promise.resolve();await Promise.resolve();
  assert.ok(shell.firstElementChild!.hasAttribute('data-bb-chat-ui-info-guard'));
  assert.equal(resolvedStyle(shell.querySelector('section')!).display,'none');
  stop();assert.equal(f.document.querySelector('[data-bb-chat-ui-info-guard], [data-bb-chat-ui-info-holds-request]'),null);
 }finally{stop();f.dom.window.close();}
});

test('detached composer shells stop scheduling layout for the remaining chat',async()=>{
 const f=fixture(),first=f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
 const second=f.document.querySelector('[data-promptbox-shell]')!.cloneNode(true) as HTMLElement;f.document.body.append(second);
 let reads=0;first.getBoundingClientRect=()=>{reads++;return {width:900}as DOMRect;};
 const stop=injectComposerInfo(f.document);
 try{
  await f.tick();second.remove();await f.tick();reads=0;
  second.querySelector('section[aria-label="Goal"] button')!.textContent='detached change';await f.tick();
  assert.equal(reads,0,'a removed shell must not keep a live mutation subscription');
 }finally{stop();f.dom.window.close();}
});

test('request markers follow nested wrappers, Secret expansion and queue collapse rows before paint',async()=>{
  const f=fixture(),shell=f.document.querySelector('[data-promptbox-shell]')!,stack=shell.querySelector(':scope > .grid')!;
  const stop=injectComposerInfo(f.document);
  try {
    const holder=f.document.createElement('section');
    holder.innerHTML='<div data-level><div data-testid="plugin-request-banner"><section data-testid="plugin-interaction-shell"><div>Secret</div><form class="@container/secrets"></form></section></div></div>';
    stack.append(holder);await Promise.resolve();await Promise.resolve();
    assert.ok(holder.firstElementChild!.hasAttribute('data-bb-chat-ui-info-holds-request'),'all nested ancestors are protected');
    assert.ok(shell.hasAttribute('data-bb-chat-ui-info-collapsed-interaction'));
    const secret=holder.querySelector('[data-testid="plugin-interaction-shell"]')!,form=secret.querySelector('form')!;
    assert.ok(secret.hasAttribute('data-bb-chat-ui-info-secret-form'));
    secret.setAttribute('data-expanded','');await Promise.resolve();await Promise.resolve();
    assert.equal(shell.hasAttribute('data-bb-chat-ui-info-collapsed-interaction'),false);
    form.className='other-form';await Promise.resolve();await Promise.resolve();
    assert.equal(secret.hasAttribute('data-bb-chat-ui-info-secret-form'),false,'reused forms release Secret styling');
    form.className='@container/secrets';await Promise.resolve();await Promise.resolve();
    assert.ok(secret.hasAttribute('data-bb-chat-ui-info-secret-form'));
    holder.remove();await Promise.resolve();await Promise.resolve();
    const queue=stack.querySelector('section[aria-label="Queued messages"]')!;
    const collapse=f.document.createElement('div');collapse.innerHTML='<button aria-label="Collapse queued messages">Collapse</button>';queue.append(collapse);
    await Promise.resolve();await Promise.resolve();
    assert.ok(collapse.hasAttribute('data-bb-chat-ui-info-queue-collapse-wrap'));
    collapse.firstElementChild!.setAttribute('aria-label','Other action');await Promise.resolve();await Promise.resolve();
    assert.equal(collapse.hasAttribute('data-bb-chat-ui-info-queue-collapse-wrap'),false);
    shell.remove();await f.tick();
    assert.equal(secret.hasAttribute('data-bb-chat-ui-info-secret-form'),false,'detached requests release markers');
    assert.equal(holder.firstElementChild!.hasAttribute('data-bb-chat-ui-info-holds-request'),false);
  } finally {stop();f.dom.window.close();}
});

test('a late inline composer inside the timeline is discovered and cleaned up',async()=>{
 const f=fixture(),stop=injectComposerInfo(f.document);
 try {
  const timeline=f.document.createElement('main');timeline.setAttribute('data-timeline-items','');f.document.body.append(timeline);await f.tick();
  const shell=f.document.querySelector('[data-promptbox-shell]')!.cloneNode(true) as HTMLElement;
  shell.querySelector('[data-bb-chat-ui-info-bar]')?.remove();
  const wrapper=f.document.createElement('article');wrapper.append(shell);timeline.append(wrapper);await f.tick();
  assert.ok(shell.querySelector('[data-bb-chat-ui-info-bar]'),'inline composer is classified');
  wrapper.remove();await f.tick();
  assert.equal(shell.querySelector('[data-bb-chat-ui-info-bar]'),null);
 } finally {stop();f.dom.window.close();}
});

test("open native popover titles are read-only while actions and inner disclosures stay interactive", async () => {
  const f=fixture();
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const specs=[['plan','Prompt mode','thread-prompt-mode-card-toggle'],['todos','To-do list','thread-todo-card-toggle'],['workflow','Workflow','workflow-title'],['background','Background commands','thread-background-commands-card-toggle'],['machine','Machine status','machine-status-toggle']];
  let actions=0;
  for(const [key,label,id] of specs){
    stack.querySelector(`section[aria-label="${label}"]`)?.remove();
    const card=f.document.createElement('section');card.setAttribute('aria-label',label);
    card.innerHTML=`<div class="flex"><button id="${id}" aria-label="${label}" aria-expanded="false" aria-controls="${key}-body" tabindex="0" class="cursor-pointer"><span>${label}</span></button><button data-real-action>Action</button></div><section id="${key}-body" hidden><button data-inner aria-expanded="false" aria-controls="${key}-inner">Phase</button><div id="${key}-inner" hidden>Details</div></section>`;
    stack.append(card);
    for(const button of card.querySelectorAll<HTMLButtonElement>('button[aria-expanded]'))button.addEventListener('click',()=>{const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(expanded));f.document.getElementById(button.getAttribute('aria-controls')!)!.hidden=!expanded;});
    card.querySelector('[data-real-action]')!.addEventListener('click',()=>actions++);
  }
  const stop=injectComposerInfo(f.document);
  try{
    for(const [key,label,id] of specs){
      f.click('[data-bb-chat-ui-info-all]');f.click(`[data-bb-chat-ui-info-choice="${key}"]`);await f.tick();
      const title=f.document.getElementById(id)!;const card=title.closest('section[aria-label]')!;
      assert.equal(title.getAttribute('aria-expanded'),'true',`${key}: pill still opens the native body`);
      assert.equal(title.getAttribute('tabindex'),'-1',`${key}: title is not an extra tab stop`);
      assert.equal(resolvedStyle(title).cursor,'default',`${key}: read-only title has a normal cursor`);
      title.querySelector('span')!.click();assert.equal(title.getAttribute('aria-expanded'),'true',`${key}: nested title click cannot collapse the body`);
      const keydown=new f.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});title.dispatchEvent(keydown);assert.equal(keydown.defaultPrevented,true);
      (card.querySelector('[data-real-action]') as HTMLButtonElement).click();
      const inner=card.querySelector<HTMLButtonElement>('[data-inner]')!;inner.click();assert.equal(inner.getAttribute('aria-expanded'),'true',`${key}: internal expansion remains available`);
      (card.querySelector('[data-bb-chat-ui-info-native-dismiss]') as HTMLButtonElement).click();
      assert.equal(title.getAttribute('aria-expanded'),'false',`${key}: close still collapses the native body`);
      assert.equal(title.getAttribute('tabindex'),'0',`${key}: standalone tab order is restored`);
      assert.equal(title.hasAttribute('aria-disabled'),false);
    }
    assert.equal(actions,specs.length);
  }finally{stop();f.dom.window.close();}
});

test("the close stays on the first 28px head line without measuring or observing the header", async () => {
  const f=fixture();const card=f.document.querySelector<HTMLElement>('section[aria-label="To-do list"]')!;
  const title=card.querySelector<HTMLElement>('button')!;
  let measured=0;
  title.getBoundingClientRect=()=>{measured++;return {x:0,y:0,left:0,top:0,right:300,bottom:60,width:300,height:60,toJSON(){}};};
  const originalParent=title.parentElement;card.style.setProperty('--bb-chat-ui-info-title-height','52px');
  const instances:{targets:Set<Element>}[]=[];
  class Observer {targets=new Set<Element>();constructor(){instances.push(this);}observe(n:Element){this.targets.add(n);}unobserve(n:Element){this.targets.delete(n);}disconnect(){this.targets.clear();}}
  Object.defineProperty(f.dom.window,'ResizeObserver',{configurable:true,value:Observer});
  const stop=injectComposerInfo(f.document);
  try{
    f.click('[data-bb-chat-ui-info-trigger="todos"]');await f.tick();
    const close=card.querySelector('[data-bb-chat-ui-info-native-dismiss]')!;
    assert.equal(resolvedStyle(close).top,"17px",'a wrapped head keeps the close on its first line');
    assert.equal(measured,0,'the head is never measured for the close');
    assert.equal(card.style.getPropertyValue('--bb-chat-ui-info-title-height'),'52px','the card style is left untouched');
    assert.equal(title.parentElement,originalParent);
    f.click('[data-bb-chat-ui-info-native-dismiss]');
    assert.equal(card.style.getPropertyValue('--bb-chat-ui-info-title-height'),'52px');
  }finally{stop();f.dom.window.close();}
});

test("all static list statuses share padded rounded hover rows and Goal control whitespace stays flat", async () => {
  const f=fixture();const card=f.document.querySelector<HTMLElement>('section[aria-label="To-do list"]')!;
  card.querySelector('#todos')!.innerHTML='<ul class="px-2.5"><li class="rounded-md bg-background/70 px-2 py-1">Running</li><li class="rounded-md px-2 py-0.5">Pending</li><li class="rounded-md px-2 py-0.5">Completed</li><li class="rounded-md bg-destructive/5 px-2 py-0.5">Failed</li></ul>';
  const workflow=f.document.createElement('section');workflow.setAttribute('aria-label','Workflow');workflow.innerHTML='<button aria-expanded="false" aria-controls="workflow-list">Workflow</button><section id="workflow-list" role="region" hidden><div class="rounded-md bg-background/70 min-h-7 px-2 py-1">Running</div><div class="rounded-md min-h-7 px-2 py-0.5">Done</div><div class="rounded-md min-h-7 px-2 py-0.5">Queued</div><button aria-expanded="false">Phase</button></section>';card.parentElement!.append(workflow);
  const stop=injectComposerInfo(f.document);
  try{
    for(const [key,root,selector] of [['todos',card,'li'],['workflow',workflow,'div.min-h-7']] as const){
      f.click('[data-bb-chat-ui-info-all]');f.click(`[data-bb-chat-ui-info-choice="${key}"]`);await f.tick();
      for(const row of root.querySelectorAll(selector)){
        const s=resolvedStyle(row);assert.equal(s.padding,key==='workflow'?'2px 4px':'4px',`${key}: all statuses have the same inner gutter`);assert.equal(s.borderRadius,"8px");assert.equal(s.transition,'background-color 150ms ease-out');assert.equal(s.cursor,'default');
      }
    }
  }finally{stop();f.dom.window.close();}
});

test("native list viewports leave room for rounded row backgrounds without clipping their side gutters", async () => {
  const f=fixture();const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const native=f.document.createElement('style');native.textContent='.overflow-hidden{overflow:hidden}.overflow-y-auto{overflow-y:auto}.px-2\\.5{padding-left:10px;padding-right:10px}.max-h-40{max-height:160px}';f.document.head.append(native);
  const cards=[
    ['todos','To-do list','<ul class="max-h-40 overflow-y-auto px-2.5"><li class="rounded-md px-2">Todo</li></ul>','ul'],
    ['workflow','Workflow','<div data-detail-scroll-area="base" class="overflow-y-auto px-2.5"><button aria-expanded="false">Phase</button><div class="min-h-7">Agent</div></div>','[data-detail-scroll-area]'],
    ['background','Background commands','<div><div class="px-3">Command</div></div>',null]
  ] as const;
  for(const [key,label,body] of cards){
    stack.querySelector(`section[aria-label="${label}"]`)?.remove();const c=f.document.createElement('section');c.setAttribute('aria-label',label);
    c.innerHTML=`<button aria-expanded="false" aria-controls="${key}-paint-body">${label}</button><section role="region" id="${key}-paint-body" hidden class="overflow-hidden"><div class="overflow-hidden bg-popover">${body}</div></section>`;stack.append(c);
    const trigger=c.querySelector('button')!;trigger.addEventListener('click',()=>{const open=trigger.getAttribute('aria-expanded')!=='true';trigger.setAttribute('aria-expanded',String(open));c.querySelector('section')!.hidden=!open;});
  }
  const stop=injectComposerInfo(f.document),style=(n:Element)=>resolvedStyle(n);
  try{
    for(const [key,label,,selector] of cards){
      f.click('[data-bb-chat-ui-info-all]');f.click(`[data-bb-chat-ui-info-choice="${key}"]`);await f.tick();const c=stack.querySelector(`section[aria-label="${label}"]`)!;
      assert.equal(style(c.querySelector('section[role="region"]')!).overflow,'visible',`${key}: the outer reveal wrapper does not cut off row corners`);
      assert.equal(style(c.querySelector('section[role="region"] > div')!).overflow,'visible',`${key}: the native body slab does not cut off row corners`);
      assert.equal(style(c.querySelector('section[role="region"]')!).minWidth,'0px',`${key}: native reveal fits a narrow card`);
      assert.equal(style(c.querySelector('section[role="region"] > div')!).minWidth,'0px',`${key}: native grid content can shrink without widening the hover rows`);
      if(selector){
        const viewport=c.querySelector(selector)!;const s=style(viewport);
        if(key==='todos'){
          assert.equal(s.paddingLeft,'0px');assert.equal(s.paddingRight,'0px');
          assert.equal(parseFloat(s.marginLeft)||0,0);assert.equal(parseFloat(s.marginRight)||0,0);
          const row=style(viewport.querySelector('li')!);
          assert.equal(parseFloat(row.marginLeft)+parseFloat(row.paddingLeft),0,'only the row extends its hover paint; its content stays at the title edge');
        }else{
          assert.equal(s.paddingLeft,"4px");assert.equal(s.paddingRight,"4px");assert.equal(s.marginLeft,"-4px");assert.equal(s.marginRight,"-4px");assert.equal(s.width,"calc(100% + 8px)");
        }
        assert.equal(s.overflow,'visible','the shared popover handles scrolling without clipping row corners');
      }
      if(key==='workflow')for(const row of c.querySelectorAll('[data-detail-scroll-area] > *')){const s=style(row);assert.equal(s.width,"calc(100% + 8px)");assert.equal(s.marginLeft,"-4px");assert.equal(s.borderRadius,"8px");}
      if(key==='todos')assert.equal(style(c.querySelector('ul')!).maxHeight,'none');
    }
  }finally{stop();}
  assert.equal(style(stack.querySelector('section[aria-label="To-do list"] ul')!).paddingLeft,'10px','unload restores native viewport gutters');
  assert.equal(style(stack.querySelector('section[aria-label="Workflow"] section[role="region"]')!).overflow,'hidden','unload restores native reveal clipping');f.dom.window.close();
});

test("information popovers share the Diff height cap without smaller native list limits", async () => {
  const f=fixture(),stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const native=f.document.createElement('style');native.textContent='.native-todo-cap{max-height:160px;overflow-y:auto}[data-detail-scroll-area]{max-height:288px;overflow-y:auto}';f.document.head.append(native);
  const todo=stack.querySelector('section[aria-label="To-do list"]')!;
  todo.querySelector('#todos')!.innerHTML='<ul class="native-todo-cap"><li>To-do</li></ul>';
  const workflow=f.document.createElement('section');workflow.setAttribute('aria-label','Workflow');workflow.innerHTML='<button aria-expanded="false" aria-controls="height-workflow">Workflow</button><section role="region" id="height-workflow"><div data-detail-scroll-area>Agents</div></section>';stack.append(workflow);
  const stop=injectComposerInfo(f.document),style=(n:Element)=>resolvedStyle(n);
  try{
    for(const kind of ['diff','todos','workflow','queue','children','goal','other']){
      f.click('[data-bb-chat-ui-info-all]');f.click(`[data-bb-chat-ui-info-choice="${kind}"]`);await f.tick();
      const popup=f.document.querySelector(`[data-bb-chat-ui-info-open="${kind}"], [data-bb-chat-ui-info-diff]`)!;
      assert.equal(style(stack).getPropertyValue('--bb-chat-ui-info-max-height'),'min(50dvh,26rem)');
      assert.equal(style(popup).maxHeight,'var(--bb-chat-ui-info-max-height)',`${kind}: uses the shared Diff cap`);
      assert.equal(style(popup).height,'auto','short content does not receive a fixed tall box');
      if(kind==='goal')assert.equal(style(popup.querySelector('#goal')!).flexShrink,'0','a long Goal body must scroll rather than shrink inside its clipping wrapper');
    }
    f.click('[data-bb-chat-ui-info-all]');f.click('[data-bb-chat-ui-info-choice="todos"]');await f.tick();
    assert.equal(style(todo.querySelector('ul')!).maxHeight,'none');assert.equal(style(todo.querySelector('ul')!).overflow,'visible');
    f.click('[data-bb-chat-ui-info-all]');f.click('[data-bb-chat-ui-info-choice="workflow"]');await f.tick();
    assert.equal(style(workflow.querySelector('[data-detail-scroll-area]')!).maxHeight,'none');
  }finally{stop();}
  assert.equal(style(todo.querySelector('ul')!).maxHeight,'160px','unload restores native list limits');
  assert.equal(style(workflow.querySelector('[data-detail-scroll-area]')!).maxHeight,'288px');f.dom.window.close();
});

test("compact information lists share the background row density without native margin stacking", async () => {
  const f=fixture(),stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const native=f.document.createElement('style');
  native.textContent='.space-y-1 > li { margin-bottom:4px } .flex-col { display:flex; flex-direction:column } .gap-1\\.5 { row-gap:6px } .gap-0\\.5 { row-gap:2px } .mt-1 { margin-top:4px }';
  f.document.head.append(native);
  f.document.querySelector('#todos')!.innerHTML='<ul class="space-y-1 px-2.5"><li class="text-xs bg-background/70">Running</li><li class="text-xs">Pending</li><li class="text-xs">Completed</li></ul>';
  for(const [kind,label,body,id] of [
    ['background','Background commands','<div class="flex flex-col gap-0.5 py-1"><div class="px-3 text-xs">Command A</div><div class="px-3 text-xs">Command B</div></div>','thread-background-commands-card-body'],
    ['workflow','Workflow','<div class="flex flex-col gap-1.5"><div><button aria-expanded="true">Phase A</button><div class="mt-1 flex flex-col"><div class="min-h-7 text-xs">Running agent</div><div class="min-h-7 text-xs">Queued agent</div></div></div><div><button aria-expanded="false">Phase B</button></div></div>','density-workflow']
  ]){
    const card=f.document.createElement('section');card.setAttribute('aria-label',label);
    card.innerHTML=`<button aria-expanded="false" aria-controls="${id}">${kind}</button><section id="${id}" role="region" hidden><div class="bg-popover">${body}</div></section>`;
    const toggle=card.querySelector('button')!,region=card.querySelector('section')!;
    toggle.addEventListener('click',()=>{region.hidden=!region.hidden;toggle.setAttribute('aria-expanded',String(!region.hidden));});stack.append(card);
  }
  const stop=injectComposerInfo(f.document),paint=(node:Element)=>resolvedStyle(node);
  try{
    for(const [kind,rowSelector,groups] of [
      ['todos','ul > li',['ul']],
      ['background','#thread-background-commands-card-body > div > div > div.px-3',['#thread-background-commands-card-body > div > div']],
      ['workflow','section[role="region"] div.min-h-7, section[role="region"] button[aria-expanded]',['section[role="region"] .gap-1\\.5','section[role="region"] .mt-1']]
    ] as const){
      f.click('[data-bb-chat-ui-info-all]');f.click(`[data-bb-chat-ui-info-choice="${kind}"]`);await f.tick();
      const card=stack.querySelector(`[data-bb-chat-ui-info-open="${kind}"]`)!;
      assert.equal(paint(stack).getPropertyValue('--bb-chat-ui-info-row-gap'),'6px','the background row gap is the shared reference');
      for(const row of card.querySelectorAll(rowSelector)){
        const css=paint(row);assert.equal(css.minHeight,'24px');assert.equal(css.padding,kind==='workflow'?'2px 4px':'4px');assert.equal(css.fontSize,'12px');assert.equal(css.lineHeight,'14px');
        assert.equal(css.marginTop,'0px');assert.equal(css.marginBottom,'0px','native space-y margins do not add another gap');
      }
      for(const selector of groups)assert.equal(paint(card.querySelector(selector)!).rowGap,'6px',`${kind}: peers use one gap`);
      if(kind==='workflow')assert.equal(paint(card.querySelector('.mt-1')!).marginTop,'6px','phase-to-agent spacing follows peer spacing');
    }
  }finally{stop();}
  assert.equal(paint(f.document.querySelector('#todos li')!).marginBottom,'4px','unload restores the native list spacing');
  assert.equal(paint(f.document.querySelector('#density-workflow .gap-1\\.5')!).rowGap,'6px');
  f.dom.window.close();
});


test("Workflow header keeps its title above live metadata without moving native nodes", async () => {
  const f=fixture();
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const card=f.document.createElement('section');card.setAttribute('aria-label','Workflow');
  card.innerHTML='<button type="button" aria-label="Workflow: Release" aria-controls="workflow-header-body" aria-expanded="false" class="flex min-h-8 w-full min-w-0 items-center px-3 py-1.5"><svg data-icon-root></svg><span class="flex min-w-0 flex-1 items-center"><span class="min-w-0 truncate font-medium" title="Release">Release</span><span class="shrink-0 text-2xs">1/3 agents</span><span class="shrink-0 text-2xs">45s</span></span><div role="presentation" aria-hidden="true" class="flex w-16"><span>progress</span></div><span class="ml-auto w-8"></span></button><section role="region" id="workflow-header-body" hidden><div data-detail-scroll-area class="py-2"><button aria-expanded="false" data-phase>Phase</button></div></section>';
  stack.append(card);
  const header=card.querySelector<HTMLButtonElement>('button')!;
  const summary=header.querySelector<HTMLElement>('.flex-1')!;
  const [title,count,time]=Array.from(summary.children) as HTMLElement[];
  const progress=header.querySelector<HTMLElement>('[role="presentation"]')!;
  header.addEventListener('click',()=>{const expanded=header.getAttribute('aria-expanded')!=='true';header.setAttribute('aria-expanded',String(expanded));card.querySelector<HTMLElement>('#workflow-header-body')!.hidden=!expanded;});
  const stop=injectComposerInfo(f.document),paint=(n:Element)=>resolvedStyle(n);
  try {
    f.click('[data-bb-chat-ui-info-trigger="workflow"]');await f.tick();
    assert.equal(paint(header).display,'grid');
    assert.equal(paint(header).paddingRight,"34px",'reserve the shared close gutter even with native px-3');
    assert.equal(paint(count).gridColumn,'1 / 3','metadata starts at the same left edge as list rows');
    assert.equal(paint(header).paddingBottom,'6px','leave a small gap below metadata without restoring both native gutters');
    assert.equal(paint(card.querySelector('[data-detail-scroll-area]')!).paddingTop,'0px','list starts directly below metadata with only its row padding');
    assert.equal(paint(summary).display,'contents');
    assert.equal(paint(title).gridRow,'1');
    assert.equal(paint(count).gridRow,'2');assert.equal(paint(time).gridRow,'2');assert.equal(paint(progress).gridRow,'2');
    assert.equal(paint(header.querySelector('[data-bb-chat-ui-info-title-icon]')!).gridRow,'1');
    assert.equal(paint(header.querySelector('.ml-auto')!).display,'none');
    assert.equal(paint(card.querySelector('[data-bb-chat-ui-info-native-dismiss]')!).top,"17px",'the shared close sits on the 28px title row above the metadata');
    assert.equal(title.parentElement,summary);assert.equal(count.parentElement,summary);assert.equal(progress.parentElement,header);
    header.click();assert.equal(header.getAttribute('aria-expanded'),'true','title remains read-only');
    count.textContent='2/3 agents';time.textContent='1m';await f.tick();
    assert.equal(count.textContent,'2/3 agents');assert.equal(paint(count).gridRow,'2','native metadata updates stay on the second row');
    const phase=card.querySelector<HTMLButtonElement>('[data-phase]')!;let clicks=0;phase.addEventListener('click',()=>clicks++);phase.click();assert.equal(clicks,1);
    f.click('[data-bb-chat-ui-info-native-dismiss]');await f.tick();
    assert.equal(header.getAttribute('aria-expanded'),'false');assert.notEqual(paint(header).display,'grid','closed native card restores its layout');
    f.click('[data-bb-chat-ui-info-trigger="workflow"]');await f.tick();assert.equal(paint(header).display,'grid');
  } finally {stop();}
  assert.notEqual(paint(header).display,'grid');assert.notEqual(paint(summary).display,'contents');
  assert.equal(title.parentElement,summary);assert.equal(progress.parentElement,header);
  f.dom.window.close();
});

test("a grouped workflow card keeps native controls, graph rows and split metadata", async () => {
  const f=fixture();
  const utilities=f.document.createElement('style');
  utilities.textContent='.overflow-hidden{overflow:hidden}.bg-popover{background-color:rgb(255,255,255)}.bg-surface-raised-solid{background-color:rgb(20,20,20)}.bg-background\\/70{background-color:rgba(250,250,250,.7)}.border{border:1px solid rgb(9,9,9)}';
  f.document.head.append(utilities);
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const card=f.document.createElement('section');
  card.setAttribute('aria-label','Active workflows');
  card.innerHTML=`<div class="flex flex-col gap-1"><div class="flex flex-col gap-2">
    <section aria-label="Workflow" data-run="open" class="overflow-hidden rounded-lg border bg-surface-raised-solid">
      <div role="group" aria-label="Workflow controls: chat-ui-screen-check" class="flex w-full items-stretch">
        <button type="button" aria-expanded="false" aria-controls="wf-open" aria-label="Workflow: chat-ui-screen-check" class="flex min-h-8 min-w-0 flex-1 items-center gap-1.5 px-3 py-1.5">
          <svg data-icon-root></svg>
          <span class="flex min-w-0 flex-1 items-center gap-1.5">
            <span class="min-w-0 truncate font-medium" title="chat-ui-screen-check">chat-ui-screen-check</span>
            <span class="shrink-0 text-2xs">0/1 agents</span>
            <span class="shrink-0 text-2xs">30s</span>
          </span>
          <div role="presentation" aria-hidden="true" class="flex w-16 shrink-0 gap-1"><span></span></div>
          <span class="ml-auto w-6"></span>
        </button>
        <button type="button" aria-label="Open workflow chat-ui-screen-check in side panel"></button>
      </div>
      <section id="wf-open" role="region" aria-hidden="true" class="overflow-hidden">
        <div class="overflow-hidden bg-popover">
          <div data-detail-scroll-area class="overflow-hidden">
            <div class="flex flex-col gap-1.5">
              <div>
                <button type="button" aria-expanded="true" data-phase class="flex w-full items-center bg-background/70">화면 열기</button>
                <div class="mt-1 flex flex-col"><div class="flex min-h-7 w-full items-center bg-background/70" data-agent><span class="min-w-0 flex-1 truncate" data-agent-label>an-extremely-long-agent-name-that-must-not-run-past-the-card-edge</span></div><button type="button" class="flex min-h-7 w-full items-center bg-background/70" data-agent-action>열기</button></div>
              </div>
              <div class="flex items-center gap-1.5" data-idle><span class="size-3"></span><span>기기 전환</span></div>
            </div>
          </div>
          <div class="px-1 pb-1"><button type="button" aria-expanded="true" aria-controls="wf-open" aria-label="Collapse workflow chat-ui-screen-check">collapse</button></div>
        </div>
      </section>
    </section>
    <section aria-label="Workflow" data-run="closed" class="overflow-hidden border bg-surface-raised-solid">
      <div role="group" aria-label="Workflow controls: other"><button type="button" aria-expanded="false" aria-controls="wf-closed" aria-label="Workflow: other"><span class="flex flex-1"><span>other</span></span></button></div>
      <section id="wf-closed" role="region" aria-hidden="true" class="overflow-hidden"><div class="overflow-hidden bg-popover">closed</div></section>
    </section>
  </div></div>`;
  stack.append(card);
  const run=card.querySelector<HTMLElement>('[data-run="open"]')!;
  const header=run.querySelector<HTMLButtonElement>('button[aria-label^="Workflow:"]')!;
  const summary=header.querySelector<HTMLElement>('.flex-1')!;
  const [title,count,time]=Array.from(summary.children) as HTMLElement[];
  const progress=header.querySelector<HTMLElement>('[role="presentation"]')!;
  const region=card.querySelector<HTMLElement>('#wf-open')!;
  const slab=region.querySelector<HTMLElement>('.bg-popover')!;
  const collapse=run.querySelector<HTMLButtonElement>('[aria-label^="Collapse workflow"]')!;
  header.addEventListener('click',()=>{
    const expanded=header.getAttribute('aria-expanded')!=='true';
    header.setAttribute('aria-expanded',String(expanded));
    region.setAttribute('aria-hidden',String(!expanded));
  });
  const stop=injectComposerInfo(f.document),paint=(n:Element)=>resolvedStyle(n);
  const flat=(value:string)=>value==='rgba(0, 0, 0, 0)'||value==='transparent';
  try {
    f.click('[data-bb-chat-ui-info-trigger="workflow"]');await f.tick();
    assert.equal(header.getAttribute('aria-expanded'),'true','opening the popover expands the workflow body');
    const controls=header.parentElement as HTMLElement;
    assert.equal(paint(controls).display,'grid');
    assert.equal(paint(controls).gridTemplateColumns,"14px fit-content(calc(100% - 52px)) 20px minmax(0,1fr)",'the workflow title sizes the external-action position');
    assert.equal(paint(controls).gridTemplateRows,"30px auto 12px");
    assert.equal(paint(header).display,'contents','read-only title content shares the controls grid without moving nodes');
    assert.equal(paint(summary).display,'contents');
    assert.equal(paint(title).gridRow,'1');
    assert.equal(paint(title).gridColumn,'2');
    assert.equal(paint(count).gridRow,'2');assert.equal(paint(count).gridColumn,'1 / 3','agent count starts at the common content edge');
    assert.equal(paint(time).gridRow,'2');assert.equal(paint(time).gridColumn,'3 / -1');assert.equal(paint(time).justifySelf,'end');
    assert.equal(paint(progress).position,'static');
    assert.equal(paint(progress).gridColumn,'1 / -1');assert.equal(paint(progress).gridRow,'3');
    assert.equal(paint(progress).width,'100%');assert.equal(paint(progress).height,'3px');
    assert.equal(paint(header.querySelector('.ml-auto')!).display,'none','the native chevron yields to the popover close');
    assert.equal(title.parentElement,summary);assert.equal(progress.parentElement,header);
    assert.equal(paint(header).paddingLeft,'0px','metadata starts at the title edge');
    const side=run.querySelector<HTMLButtonElement>('[aria-label^="Open workflow"]')!;
    assert.equal(side.parentElement,header.parentElement,'the native side-panel control keeps its parent');
    assert.equal(paint(side).display,'none','the rectangular side-panel button is not the visible control');
    const sideIcon=header.parentElement?.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-panel-action]')!;
    assert.equal(sideIcon.getAttribute('aria-label'),side.getAttribute('aria-label'));
    assert.equal(paint(sideIcon).borderRadius,'999px','the shared icon action');
    assert.equal(paint(sideIcon).width,"20px");
    assert.equal(paint(sideIcon).alignSelf,'center');
    assert.equal(paint(sideIcon).gridColumn,'3');
    assert.equal(paint(sideIcon).gridRow,'1');
    const titleIcon=controls.querySelector<HTMLElement>('[data-bb-chat-ui-info-title-icon="workflow"]')!;
    assert.equal(paint(titleIcon).gridColumn,'1');
    assert.equal(paint(titleIcon).gridRow,'1');
    const dismiss=card.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-native-dismiss]')!;
    assert.ok(dismiss,'one close for the Workflow card');
    assert.equal(paint(dismiss).position,'absolute','the shared close sits on the card, beside the head gutter');
    assert.equal(paint(dismiss).top,"17px",'on the 28px head line with the side-panel action');
    assert.equal(paint(dismiss).width,paint(sideIcon).width);
    assert.equal(paint(dismiss).height,paint(sideIcon).height);
    assert.equal(paint(controls).paddingRight,"34px",'the head reserves the close gutter after the side-panel action');
    const agentRow=run.querySelector<HTMLElement>('[data-agent]')!;
    const agentLabel=agentRow.querySelector<HTMLElement>('[data-agent-label]')!;
    assert.equal(paint(agentRow).minWidth,'0px');
    assert.equal(paint(agentLabel).overflow,'hidden');
    assert.equal(paint(agentLabel).textOverflow,'ellipsis');
    assert.equal(paint(agentLabel).whiteSpace,'nowrap');
    header.click();assert.equal(header.getAttribute('aria-expanded'),'true','the title does not collapse the list');
    const hidden=collapse.closest('[data-bb-chat-ui-info-collapse]')??collapse;
    assert.equal(paint(hidden).display,'none','the bottom collapse is the popover close, not a second list row');
    assert.equal(flat(paint(slab).backgroundColor),true,'the list drops the opaque popover slab');
    assert.equal(paint(slab).overflow,'visible','row hover is not clipped by the reveal wrapper');
    assert.equal(paint(region).overflow,'visible');
    const workflowList=region.querySelector<HTMLElement>('[data-detail-scroll-area]')!;
    assert.equal(paint(workflowList).marginTop,'0px','the progress bar replaces the divider at the list boundary');
    assert.equal(paint(workflowList).paddingTop,'0px','the card body does not add another top inset');
    assert.equal(paint(workflowList).borderTopWidth,'0px');
    const composerCss=f.document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info')!.textContent!;
    assert.doesNotMatch(composerCss,/content:"·"/,'split metadata has no separator');
    assert.doesNotMatch(composerCss,/counter\(workflow-step/,'graph nodes have no phase numbers');
    assert.equal(paint(run).overflow,'visible');
    assert.equal(flat(paint(run).backgroundColor),true);
    const phase=run.querySelector<HTMLElement>('[data-phase]')!;
    const idle=run.querySelector<HTMLElement>('[data-idle]')!;
    assert.equal(paint(idle).minHeight,paint(phase).minHeight,'an inactive phase uses the expandable row height');
    assert.equal(paint(idle).padding,paint(phase).padding);
    assert.equal(paint(idle).marginLeft,paint(phase).marginLeft,'an inactive phase shares the expandable row indent');
    const agent=run.querySelector<HTMLElement>('[data-agent]')!;
    const action=run.querySelector<HTMLElement>('[data-agent-action]')!;
    for (const row of [phase,agent,action]) {
      assert.equal(paint(row).minHeight,"24px");
      assert.equal(paint(row).padding,"2px 4px");
      assert.equal(flat(paint(row).backgroundColor),true,`${row.getAttribute('data-phase')??row.getAttribute('data-agent')??'action'} drops the native wash`);
      assert.equal(paint(row).boxShadow,'none');
    }
    const closed=card.querySelector<HTMLElement>('#wf-closed')!;
    assert.equal(paint(closed).overflow,'hidden','a collapsed sibling workflow stays clipped');
  } finally {stop();}
  f.dom.window.close();
});

test('inactive info is hidden by default while active overflow, counts and the opt-in update live',async()=>{
 const f=fixture(),stack=f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!,source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
 for(const node of Array.from(stack.children))if(!node.contains(source))node.remove();
 const settings:Record<string,unknown>={};const publish=()=>source.setAttribute('data-bb-chat-ui-info-settings',JSON.stringify(settings));publish();
 let width=1000;stack.getBoundingClientRect=()=>({width,left:0,right:width,top:0,bottom:32,height:32,x:0,y:0,toJSON(){}});
 Object.defineProperty(f.dom.window.HTMLElement.prototype,'offsetWidth',{configurable:true,get(){return this.hasAttribute('data-bb-chat-ui-info-trigger')?60:32;}});
 const jump=f.document.createElement('button');jump.setAttribute('aria-label','Scroll to latest event');jump.className='invisible';stack.closest('[data-scroll-footer]')!.append(jump);
 const stop=injectComposerInfo(f.document),group=()=>f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-stack-icons]')!,more=()=>f.document.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-all]')!,count=()=>f.document.querySelector('[data-bb-chat-ui-info-count]')!.textContent;
 try{
  assert.equal(group().hidden,true);assert.equal(more().hidden,true);assert.equal(f.document.querySelector('[data-bb-chat-ui-info-stack-kind]'),null);
  const bar=f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!;assert.equal(bar.hidden,true,'empty information does not leave an empty row');
  jump.classList.remove('invisible');await f.tick();assert.equal(bar.hidden,false,'Latest remains reachable even when no information is active');
  jump.classList.add('invisible');await f.tick();assert.equal(bar.hidden,true);
  for(const[key,label]of [['goal','Goal'],['plan','Plan'],['todos','To-do list'],['workflow','Workflow'],['background','Background commands']]){
   const card=f.document.createElement('section');card.setAttribute('data-bb-chat-ui-info-kind',key);card.setAttribute('aria-label',label);card.innerHTML=`<h3>${label}</h3><p>Active information</p>`;stack.append(card);
  }
  await f.tick();assert.equal(group().hidden,true,'all active pills fit without reserving an empty stack');
  width=80;f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await f.tick();
  assert.equal(group().hidden,false);assert.equal(count(),'+2','five folded active families become three icons plus two');
  assert.equal(more().hasAttribute('data-bb-chat-ui-info-active'),true);
  assert.deepEqual([...group().querySelectorAll('[data-bb-chat-ui-info-stack-kind]')].map(n=>n.getAttribute('data-bb-chat-ui-info-stack-kind')),['plan','goal','todos']);
  more().click();assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice]').length,5,'default catalog does not invent empty entries');
  settings.showInactiveInfo=true;publish();await f.tick();
  assert.equal(count(),'+12','opt-in includes every listed family');
  assert.equal(f.document.querySelectorAll('[data-bb-chat-ui-info-choice]').length,15);
  settings.showGoal='끄기';publish();await f.tick();assert.equal(count(),'+11');assert.equal(f.document.querySelector('[data-bb-chat-ui-info-choice="goal"]'),null);
  settings.showInactiveInfo=false;publish();await f.tick();assert.equal(count(),'+1','disabled and empty families do not inflate the active count');
  f.click('[data-bb-chat-ui-info-menu] [data-bb-chat-ui-card-close]');
  width=1000;f.dom.window.dispatchEvent(new f.dom.window.Event('resize'));await f.tick();assert.equal(group().hidden,true);assert.equal(more().hidden,true);
  settings.showPlan='목록에만 표시';publish();await f.tick();assert.equal(group().hidden,false,'active catalog-only info remains reachable');assert.equal(group().querySelector('[data-bb-chat-ui-info-stack-kind]')?.getAttribute('data-bb-chat-ui-info-stack-kind'),'plan');assert.equal(more().hidden,true);
  settings.showInactiveInfo=true;publish();await f.tick();more().click();
  for(const card of stack.querySelectorAll('section[data-bb-chat-ui-info-kind]'))card.remove();await f.tick();
  settings.showInactiveInfo=false;publish();await f.tick();assert.equal(bar.hidden,true);assert.equal(f.document.querySelector('[data-bb-chat-ui-info-menu]'),null,'an all-info menu closes when its last active information disappears');
 }finally{stop();f.dom.window.close();}
});

// One design port: every opened card reads its face, head line, close and controls from lib/info-card.ts.
test("every opened card shares one anatomy: one frost face, a 28px head, a fixed close and no second surface", async () => {
  const f=fixture();
  const style=f.document.createElement('style'); style.textContent=queuedMessagesCss; f.document.head.append(style);
  const stack=f.document.querySelector('[data-promptbox-shell] > .grid')!;
  const source=f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
  for (const kind of ['goal','plan','todos','workflow','background','machine','fallback','queue','annotations','pullRequest','parent','other','status'])
    source.insertAdjacentHTML('beforeend',`<span data-bb-chat-ui-info-icon="${kind}"><svg data-family="${kind}" /></span>`);
  for (const [kind,label] of [['plan','Prompt mode'],['workflow','Workflow'],['background','Background commands'],['machine','Machine status'],['fallback','Model fallback']]) {
    const card=f.document.createElement('section'); card.setAttribute('aria-label',label);
    const action=kind==='plan'?'<button aria-label="Exit plan mode"><svg /></button>':kind==='fallback'?'<button aria-label="Dismiss model fallback"><svg /></button>':'<button>Open in side panel</button>';
    card.innerHTML=`<div><button ${kind==='machine'?'id="machine-status-toggle"':''} aria-expanded="false" aria-controls="anatomy-${kind}">${label}</button>${action}</div><div id="anatomy-${kind}" hidden><div><button class="row">Row</button><p>Details</p></div></div>`;
    const toggle=card.querySelector('button')!;
    toggle.addEventListener('click',()=>{const expanded=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(expanded));card.querySelector<HTMLElement>(`#anatomy-${kind}`)!.hidden=!expanded;});
    stack.append(card);
  }
  stack.insertAdjacentHTML('beforeend','<div class="agentation-staging-shell"><div><div><svg data-icon="ChatFeedback" /><p>Annotations</p><button aria-expanded="true" aria-label="Collapse staged annotations"><svg /></button></div><div><button>Discard all</button><button><svg data-send />Send all</button></div></div><div class="grid"><div><div><ul><li><span aria-hidden="true"><span>main</span><span>button</span><span>x</span><span>Make it larger</span></span><button aria-label="Discard annotation"><svg data-discard /></button></li></ul></div></div></div></div>');
  f.document.querySelector('[data-queued-messages-scroll-frame]')!.innerHTML='<div data-queued-messages-scroll><div data-queued-message-row><div class="flex"><div class="min-w-0">Message</div><button aria-label="Queued message 1 actions"><svg /></button></div></div></div>';
  const surfaceFree=(card:Element,kind:string) => {
    const offenders:string[]=[];
    for (const node of card.querySelectorAll<HTMLElement>('*')) {
      if (node.closest('input, textarea, select, pre, code, [contenteditable="true"], [data-bb-chat-ui-info-avatar], [role="presentation"]')) continue;
      if (node.matches('[data-bb-chat-ui-card-close], [data-bb-chat-ui-card-action], [data-bb-chat-ui-card-button]') || node.closest('[hidden]')) continue;
      const css=resolvedStyle(node);
      // jsdom keeps var() faces only on the shorthand and drops color-mix() fills; the live audit covers those.
      const face=css.getPropertyValue('background');
      const paint=(css.backgroundColor && !['rgba(0, 0, 0, 0)','transparent'].includes(css.backgroundColor)) || /var\(/.test(face);
      const shadow=css.boxShadow && css.boxShadow!=='none';
      const blur=css.getPropertyValue('backdrop-filter') && css.getPropertyValue('backdrop-filter')!=='none';
      const border=['Top','Right','Bottom','Left'].some(side=>parseFloat(css.getPropertyValue(`border-${side.toLowerCase()}-width`))>0);
      if (paint||shadow||blur||border) offenders.push(`${node.tagName.toLowerCase()}${node.getAttribute('aria-label')?`[${node.getAttribute('aria-label')}]`:''} ${paint?css.backgroundColor+face:''} ${shadow?'shadow':''} ${blur?'blur':''} ${border?'border':''}`.trim());
    }
    assert.deepEqual(offenders,[],`${kind}: no element inside the card paints a second surface`);
  };
  const stop=injectComposerInfo(f.document);
  const css=(node:Element)=>resolvedStyle(node);
  try {
    await f.tick();
    for (const kind of ['all','diff','children','pullRequest','goal','plan','todos','workflow','background','machine','fallback','queue','annotations','other']) {
      f.click('[data-bb-chat-ui-info-all]');
      if (kind!=='all') f.click(`[data-bb-chat-ui-info-choice="${kind}"]`);
      await f.tick();
      const card=f.document.querySelector<HTMLElement>('[data-bb-chat-ui-info-menu], [data-bb-chat-ui-info-open]')!;
      assert.ok(card,`${kind}: a card opened`);
      assert.equal(css(card).padding,kind==='pullRequest'?'0px':'12px 16px',`${kind}: one card gutter`);
      assert.equal(css(card).borderRadius,'18px',`${kind}: one card radius`);
      const closes=Array.from(card.querySelectorAll('[data-bb-chat-ui-card-close]')).filter(node=>css(node).display!=='none');
      assert.equal(closes.length,1,`${kind}: exactly one close slot`);
      assert.equal(css(closes[0]).position,'absolute',`${kind}: close sits on the card, not in a per-card grid`);
      assert.equal(css(closes[0]).top,kind==='pullRequest'?'8px':'17px',`${kind}: close centers on its row`);
      assert.equal(css(closes[0]).right,kind==='pullRequest'?'6px':'10px',`${kind}: close uses its card inset`);
      const head=card.querySelector('[data-bb-chat-ui-card-head]');
      assert.ok(head,`${kind}: a head slot`);
      assert.equal(css(head!).minHeight,kind==='pullRequest'?'36px':'30px',`${kind}: one row height`);
      surfaceFree(card,kind);
      f.click('[data-bb-chat-ui-card-close]');
      await f.tick();
    }
  } finally {stop(); f.dom.window.close();}
});

test("draft editor mutations do not schedule information sync or fit", async () => {
  const f = fixture();
  const editor = f.document.createElement('div');
  editor.setAttribute('data-promptbox-editor-content', '');
  editor.innerHTML = '<div class="ProseMirror" contenteditable="true"><p>draft</p></div>';
  f.document.querySelector('[data-follow-up-composer]')!.append(editor);
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    let frames = 0;
    const raf = f.dom.window.requestAnimationFrame.bind(f.dom.window);
    f.dom.window.requestAnimationFrame = cb => { frames++; return raf(cb); };
    for (let i = 0; i < 3; i++) {
      editor.querySelector('p')!.textContent += ' input';
      editor.querySelector('p')!.setAttribute('aria-label', 'draft ' + i);
      await f.tick();
    }
    assert.equal(frames, 0, 'draft changes have no information or geometry dependency');
    f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent = '+20 −4 · 4 files';
    await f.tick();
    assert.ok(frames > 0, 'native information changes still sync');
  } finally { stop(); f.dom.window.close(); }
});

test("unchanged information revisions reuse measured pill widths", async () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true, get() {
    if (this.hasAttribute('data-bb-chat-ui-info-trigger')) reads++;
    return 60;
  } });
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    reads = 0;
    const source = f.document.querySelector('[data-bb-chat-ui-info-settings]')!;
    source.dispatchEvent(new f.dom.window.Event('bb-chat-ui:composer-data', { bubbles:true }));
    // A native attribute with the same label/revision also needs no width read.
    f.document.querySelector('#thread-prompt-banner-git-toggle')!.setAttribute('aria-disabled', 'false');
    await f.tick(); await f.tick();
    assert.equal(reads, 0, 'same content and scale must not remeasure every pill');
    f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent = '+200 −40 · 40 files';
    await f.tick();
    assert.ok(reads > 0, 'changed labels invalidate their width');
  } finally { stop(); f.dom.window.close(); }
});

test("unchanged data and open Goal prose skip pill geometry while native summaries stay live", async () => {
  const f = fixture();
  let reads = 0;
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true, get() { return 60; } });
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetLeft', { configurable:true, get() { reads++; return 0; } });
  f.document.querySelector('#goal')!.innerHTML = '<p>Objective</p>';
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="goal"]'); await f.tick(); await f.tick();
    reads = 0;
    f.document.querySelector('[data-bb-chat-ui-info-settings]')!.dispatchEvent(new f.dom.window.Event('bb-chat-ui:composer-data', { bubbles:true }));
    await f.tick();
    f.document.querySelector('#goal p')!.textContent = 'Updated objective';
    await f.tick();
    assert.equal(reads, 0, 'same data and card prose have no pill geometry dependency');
    f.document.querySelector('#thread-prompt-banner-git-toggle')!.textContent = '+200 −40 · 40 files';
    await f.tick();
    assert.ok(reads > 0, 'changed native summary still fits');
  } finally { stop(); f.dom.window.close(); }
});

test("a second Diff width change starts at the current animated width", async () => {
  const f = fixture();
  const source = f.document.createElement('span'); source.setAttribute('data-bb-chat-ui-head-diff', '');
  f.document.querySelector('[data-promptbox-shell] > .grid')!.append(source);
  const live = new WeakSet<HTMLElement>(), widths: Keyframe[][] = [];
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true, get() {
    if (this.getAttribute('data-bb-chat-ui-info-trigger') !== 'diff') return 60;
    if (live.has(this)) return 90;
    return this.textContent?.includes('+70') ? 220 : this.hasAttribute('aria-busy') ? 64 : 180;
  } });
  f.dom.window.HTMLElement.prototype.animate = function(frames) {
    const keyframes = frames as Keyframe[], node = this;
    if (node.getAttribute('data-bb-chat-ui-info-trigger') === 'diff' && keyframes[0]?.width) { widths.push(keyframes); live.add(node); }
    return { cancel() { live.delete(node); } } as Animation;
  };
  const stop = injectComposerInfo(f.document);
  const publish = (insertions:number) => source.setAttribute('data-bb-chat-ui-head-diff', JSON.stringify({insertions,deletions:2,files:1,branch:'feature/chat',presentation:{mode:'working',visible:true,branch:'feature/chat',label:`+${insertions} −2 · 1 file`}}));
  try {
    await f.tick(); publish(7); await f.tick();
    assert.deepEqual(widths[0].map(frame => frame.width), ['64px', '180px']);
    publish(70); await f.tick();
    assert.deepEqual(widths[1].map(frame => frame.width), ['90px', '220px'], 'an interrupted width animation must not jump back to its cached target');
  } finally { stop(); f.dom.window.close(); }
});

test("jump fit morphs a folded pill and its icon together without animating layout", async () => {
  const f = jumpFixture(); markDevice(f.document, 'desktop');
  const animations: {node:HTMLElement;frames:Keyframe[];options:KeyframeAnimationOptions;animation:Animation}[]=[];
  f.dom.window.HTMLElement.prototype.animate = function(frames,options) {
    const animation={pause(){},play(){},cancel(){ this.oncancel?.({} as AnimationPlaybackEvent); },onfinish:null,oncancel:null,startTime:null} as unknown as Animation;
    animations.push({node:this,frames:frames as Keyframe[],options:options as KeyframeAnimationOptions,animation}); return animation;
  };
  const stop=injectComposerInfo(f.document);
  try {
    await f.tick();animations.length=0;
    f.jump.classList.remove('invisible');await f.tick();
    const motion=animations.filter(a=>a.node.hasAttribute('data-bb-chat-ui-info-reflow-key'));
    const ghost=motion.find(a=>a.node.hasAttribute('data-bb-chat-ui-info-reflow-ghost'));
    assert.ok(ghost,'the outgoing pill must stay visually present as an inert overlay');
    assert.equal(ghost.node.style.position,'absolute'); assert.equal(ghost.node.getAttribute('aria-hidden'),'true');
    assert.equal(ghost.node.style.pointerEvents,'none');
    assert.ok(motion.some(a=>a.node.getAttribute('data-bb-chat-ui-info-reflow-key')?.startsWith('stack:')),'the destination icon fades in during the same transition');
    assert.equal(new Set(motion.map(a=>a.animation.startTime)).size,1,'all participants share the same start after layout work');
    for(const a of motion){
      assert.equal(a.options.duration,460);assert.equal(a.options.easing,'cubic-bezier(.22,1,.36,1)');
      assert.equal(a.options.delay??0,0);
      for(const frame of a.frames)assert.ok(Object.keys(frame).every(p=>['transform','opacity','offset','easing','composite'].includes(p)),`layout property in ${JSON.stringify(frame)}`);
    }
    let reads=0;const bounds=f.stack.getBoundingClientRect;
    f.stack.getBoundingClientRect=()=>{reads++;return bounds();};
    for(let i=0;i<3;i++){f.jump.setAttribute('class',f.jump.className);await f.tick();}
    assert.equal(reads,0,'unchanged jump state must not read layout again');
    animations.length=0;f.jump.classList.add('invisible');await f.tick();
    const reverse=animations.filter(a=>a.node.hasAttribute('data-bb-chat-ui-info-reflow-key'));
    assert.ok(reverse.some(a=>a.node.getAttribute('data-bb-chat-ui-info-reflow-key')?.startsWith('pill:')));
    for(const a of reverse){assert.equal(a.options.duration,340);assert.equal(a.options.easing,'cubic-bezier(.4,0,.2,1)');}
    stop();assert.equal(f.document.querySelector('[data-bb-chat-ui-info-reflow-layer]'),null,'unload cancels all temporary visuals');
  } finally {stop();f.dom.window.close();}
});

test('small timeline additions do not scan all connected information shells',async()=>{
 const f=fixture(),stop=injectComposerInfo(f.document);
 const timeline=f.document.createElement('main');timeline.setAttribute('data-timeline-items','');f.document.body.append(timeline);await f.tick();
 const query=f.document.querySelectorAll.bind(f.document);let scans=0;
 f.document.querySelectorAll=((selector:string)=>{if(selector==='[data-promptbox-shell]')scans++;return query(selector);}) as typeof f.document.querySelectorAll;
 try{
  const row=f.document.createElement('article');row.innerHTML='<p>One streamed message</p>';
  timeline.append(row);await f.tick();
  assert.equal(scans,0,'one ordinary row does not require discovering every existing shell');
 }finally{stop();f.dom.window.close();}
});

test('timeline message batches do not search each row for information shells',async()=>{
 const f=fixture(),stop=injectComposerInfo(f.document);
 const timeline=f.document.createElement('main');timeline.setAttribute('data-timeline-items','');f.document.body.append(timeline);await f.tick();
 const prototype=f.dom.window.Element.prototype,query=prototype.querySelector;let scans=0;
 // Count discovery queries on ordinary transcript rows only.
 prototype.querySelector=function(selector:string){if(this.hasAttribute('data-perf-row')&&selector==='[data-promptbox-shell]')scans++;return query.call(this,selector);};
 try{
  const rows=Array.from({length:80},()=>{const row=f.document.createElement('article');row.setAttribute('data-perf-row','');row.innerHTML='<p>Message</p>';return row;});
  timeline.append(...rows);await f.tick();assert.equal(scans,0,'a message-only batch does not search every row');
 }finally{prototype.querySelector=query;stop();f.dom.window.close();}
});


test("detail-only Diff revisions skip pill geometry while open details and visual inputs stay live", async () => {
  const f = fixture(), stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  const source = stack.querySelector('[data-bb-chat-ui-info-settings]')!;
  const diffSource = f.document.createElement('span');
  diffSource.hidden = true; diffSource.setAttribute('data-bb-chat-ui-head-diff', '');
  source.parentElement!.append(diffSource);
  source.insertAdjacentHTML('beforeend', '<span data-bb-chat-ui-info-icon="goal"><svg><path d="M1 1h2" /></svg></span>');
  const info = readInfoData(source)!.value;
  const children = [{ id:'child', title:'Review', providerId:'codex', state:'run' as const }];
  publishInfoData(source, { ...info, children });
  const snapshot = { insertions:7, deletions:2, files:1, branch:'feature/ui',
    presentation:{ mode:'working' as const, visible:true, branch:'feature/ui', branchLabel:null, label:'+7 −2 · 1 file' },
    detail:{ branch:'feature/ui', basis:'HEAD', baseRef:'origin/main', files:[{ path:'lib/direct.ts', status:'M', insertions:7, deletions:2 }], commits:[] } };
  publishDiffData(diffSource, { threadId:'fixture', state:'ready', summary:snapshot });
  let rectangles = 0, widths = 0, offsets = 0;
  // Count the information row's layout reads separately from open-card geometry.
  stack.getBoundingClientRect = () => { rectangles++; return new f.dom.window.DOMRect(0, 300, 900, 32); };
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true,
    // Give pills stable widths while recording repeated width measurements.
    get() { if (this.hasAttribute('data-bb-chat-ui-info-trigger')) widths++; return 60; },
  });
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetLeft', { configurable:true,
    // Record only information pills and the folded icon stack.
    get() { if (this.hasAttribute('data-bb-chat-ui-info-trigger') || this.hasAttribute('data-bb-chat-ui-info-stack-icons')) offsets++; return 0; },
  });
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="diff"]'); await f.tick(); await f.tick();
    const pill = stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="diff"]')!;
    const previous = [pill.innerHTML, pill.title, pill.getAttribute('aria-label'), pill.hidden];
    const revision = readDiffData(diffSource)!.revision;
    rectangles = widths = offsets = 0;
    const detailOnly = { ...snapshot, detail:{ ...snapshot.detail, files:[{ ...snapshot.detail.files[0], path:'lib/updated.ts' }] } };
    publishDiffData(diffSource, { threadId:'fixture', state:'ready', summary:detailOnly });
    await f.tick(); await f.tick();
    assert.ok(readDiffData(diffSource)!.revision > revision, 'the SDK detail change really advances its data revision');
    assert.match(stack.querySelector('[data-bb-chat-ui-info-menu]')!.textContent!, /lib\/updated.ts/);
    assert.deepEqual([pill.innerHTML, pill.title, pill.getAttribute('aria-label'), pill.hidden], previous);
    assert.deepEqual({ rectangles, widths, offsets }, { rectangles:0, widths:0, offsets:0 }, 'unchanged pills do not read row geometry to refresh open Diff details');

    publishDiffData(diffSource, { threadId:'fixture', state:'ready', summary:{ ...detailOnly, insertions:70,
      presentation:{ ...snapshot.presentation, label:'+70 −2 · 1 file' } } });
    await f.tick();
    assert.match(pill.textContent!, /\+70/);
    assert.ok(rectangles > 0 && widths > 0 && offsets > 0, 'a changed visible Diff label still fits');
    rectangles = widths = offsets = 0;
    source.querySelector('[data-bb-chat-ui-info-icon="goal"] path')!.setAttribute('d', 'M1 1h20');
    await f.tick();
    assert.equal(stack.querySelector('[data-bb-chat-ui-info-trigger="goal"] path')!.getAttribute('d'), 'M1 1h20');
    assert.ok(rectangles > 0 && widths > 0, 'changed pill artwork still invalidates its measured width');
    rectangles = widths = offsets = 0;
    publishInfoData(source, { ...info, children:[{ ...children[0], state:'done' }] });
    await f.tick();
    assert.equal(stack.querySelector('[data-bb-chat-ui-info-avatar][data-child="child"]')!.getAttribute('data-state'), 'done');
    assert.ok(rectangles > 0 && widths > 0, 'changed child pill state still fits its updated content');
  } finally { stop(); f.dom.window.close(); }
});

// Catalog-only availability and native artwork still determine folded stack content.

test("catalog-only Diff visibility refreshes folded icons and counts while native artwork stays live", async () => {
  const f = fixture(), stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  const source = stack.querySelector('[data-bb-chat-ui-info-settings]')!;
  const settings = { ...Object.fromEntries(infoKinds.map(kind => [kind.setting, '끄기'])),
    showDiff:'목록에만 표시', showChildren:'목록에만 표시', showTodos:'목록에만 표시', showQueue:'목록에만 표시',
    showGoal:'상단 표시', showInactiveInfo:false };
  publishInfoData(source, { ...readInfoData(source)!.value, settings });
  const childTrigger = stack.querySelector('#thread-prompt-banner-child-threads-toggle')!;
  childTrigger.insertAdjacentHTML('beforeend', '<svg><path d="M1 1h2" /></svg>');
  const diffSource = f.document.createElement('span');
  diffSource.hidden = true; diffSource.setAttribute('data-bb-chat-ui-head-diff', '');
  source.parentElement!.append(diffSource);
  const snapshot = { insertions:7, deletions:2, files:1, branch:'feature/ui',
    presentation:{ mode:'working' as const, visible:true, branch:'feature/ui', branchLabel:null, label:'+7 −2 · 1 file' },
    detail:{ branch:'feature/ui', basis:'HEAD', baseRef:'origin/main', files:[{ path:'lib/direct.ts', status:'M', insertions:7, deletions:2 }], commits:[] } };
  publishDiffData(diffSource, { threadId:'fixture', state:'ready', summary:snapshot });
  // Leave room for the Goal pill so Diff visibility cannot hide the entire information row.
  stack.getBoundingClientRect = () => new f.dom.window.DOMRect(0, 0, 900, 32);
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true,
    // Keep every exposed pill within the wide fixture row.
    get() { return 60; },
  });
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    const bar = stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!;
    const more = stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-all]')!;
    const count = stack.querySelector('[data-bb-chat-ui-info-count]')!;
    // Observe the public folded-icon order rather than internal fitting state.
    const icons = () => [...stack.querySelectorAll('[data-bb-chat-ui-info-stack-kind]')].map(node => node.getAttribute('data-bb-chat-ui-info-stack-kind'));
    assert.equal(stack.querySelector('[data-bb-chat-ui-info-trigger="diff"]'), null, 'Diff stays catalog-only');
    assert.equal(bar.hidden, false); assert.equal(stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="goal"]')!.hidden, false);
    assert.deepEqual(icons(), ['diff', 'children', 'todos']);
    assert.equal(more.hidden, false); assert.equal(count.textContent, '+1');
    publishDiffData(diffSource, { threadId:'fixture', state:'ready', summary:{ ...snapshot,
      presentation:{ ...snapshot.presentation, visible:false } } });
    await f.tick(); await f.tick();
    assert.equal(bar.hidden, false, 'Goal keeps the same row visible');
    assert.deepEqual(icons(), ['children', 'todos', 'queue'], 'a hidden Diff leaves the folded active set');
    assert.equal(more.hidden, true); assert.equal(count.textContent, '+0');
    publishDiffData(diffSource, { threadId:'fixture', state:'ready', summary:snapshot });
    await f.tick(); await f.tick();
    assert.deepEqual(icons(), ['diff', 'children', 'todos']);
    assert.equal(more.hidden, false); assert.equal(count.textContent, '+1');
    childTrigger.querySelector('path')!.setAttribute('d', 'M1 1h20');
    publishDiffData(diffSource, { threadId:'fixture', state:'ready', summary:{ ...snapshot,
      detail:{ ...snapshot.detail, files:[{ ...snapshot.detail.files[0], path:'lib/updated.ts' }] } } });
    await f.tick(); await f.tick();
    assert.equal(stack.querySelector('[data-bb-chat-ui-info-stack-kind="children"] path')!.getAttribute('d'), 'M1 1h20', 'a catalog-only native icon refreshes through the same artwork fallback as fit');
  } finally { stop(); f.dom.window.close(); }
});

// Height changes must keep card hints aligned without refitting an unchanged row.

test("height-only info resize skips pill geometry while open-card hints and width changes stay live", async () => {
  const f = fixture(), stack = f.document.querySelector<HTMLElement>('[data-promptbox-shell] > .grid')!;
  const observers: RecordingResizeObserver[] = [];
  class RecordingResizeObserver {
    targets = new Set<Element>();
    callback: ResizeObserverCallback;
    // Keep callbacks available for explicit content-box resize deliveries.
    constructor(callback:ResizeObserverCallback) { this.callback = callback; observers.push(this); }
    // Record the exact element owned by each ResizeObserver.
    observe(target:Element) { this.targets.add(target); }
    // Remove one observation when card ownership changes.
    unobserve(target:Element) { this.targets.delete(target); }
    // Drop all observations when the fixture unmounts.
    disconnect() { this.targets.clear(); }
  }
  f.dom.window.ResizeObserver = RecordingResizeObserver as unknown as typeof ResizeObserver;
  let width = 900, rectangles = 0, widths = 0, offsets = 0, cardReads = 0, menuTop = 100;
  // Simulate actual row width changes and count only the row's geometry.
  stack.getBoundingClientRect = () => { rectangles++; return new f.dom.window.DOMRect(0, 300, width, 32); };
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetWidth', { configurable:true,
    // Give each pill a nonzero intrinsic width for folding assertions.
    get() { if (this.hasAttribute('data-bb-chat-ui-info-trigger')) widths++; return 60; },
  });
  Object.defineProperty(f.dom.window.HTMLElement.prototype, 'offsetLeft', { configurable:true,
    // Separate pill placement reads from permitted card positioning reads.
    get() { if (this.hasAttribute('data-bb-chat-ui-info-trigger') || this.hasAttribute('data-bb-chat-ui-info-stack-icons')) offsets++; return 0; },
  });
  const stop = injectComposerInfo(f.document);
  try {
    await f.tick(); await f.tick();
    f.click('[data-bb-chat-ui-info-trigger="diff"]'); await f.tick(); await f.tick();
    const menu = stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-menu]')!;
    const bar = stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-bar]')!;
    menu.style.overflowY = 'auto';
    Object.defineProperty(menu, 'clientHeight', { configurable:true, value:100 });
    Object.defineProperty(menu, 'scrollHeight', { configurable:true, value:300 });
    // A height change moves the open card without changing its content-box size.
    menu.getBoundingClientRect = () => { cardReads++; return new f.dom.window.DOMRect(0, menuTop, 600, 100); };
    // Scroll hints are positioned relative to the row, independently of pill fitting.
    bar.getBoundingClientRect = () => { cardReads++; return new f.dom.window.DOMRect(0, 300, 900, 32); };
    const resize = observers.find(observer => observer.targets.has(stack));
    assert.ok(resize);
    // Deliver only the row observation so a card-size callback cannot hide a missed update.
    const deliver = (height:number) => resize.callback([{ target:stack, contentRect:new f.dom.window.DOMRect(0, 0, width, height) } as ResizeObserverEntry], resize as unknown as ResizeObserver);
    deliver(32);
    menu.dispatchEvent(new f.dom.window.Event('scroll', { bubbles:true }));
    const below = stack.querySelector<HTMLElement>('[data-bb-chat-ui-info-scroll-hint="bottom"]')!;
    assert.equal(below.hidden, false); assert.equal(below.style.top, '-124px');
    rectangles = widths = offsets = cardReads = 0;
    menuTop = 60; deliver(96);
    assert.deepEqual({ rectangles, widths, offsets }, { rectangles:0, widths:0, offsets:0 }, 'height-only notifications do not refit pills');
    assert.ok(cardReads > 0, 'the open card still measures its scroll edges');
    assert.equal(below.style.top, '-164px', 'the hint follows the card position even when its own size is unchanged');
    width = 120; deliver(96);
    assert.ok(rectangles > 0 && widths > 0, 'an actual row width change still invalidates pill geometry');
    assert.ok([...stack.querySelectorAll<HTMLElement>('[data-bb-chat-ui-info-trigger]')].some(button => button.hidden), 'the narrower row folds overflowing pills');
  } finally { stop(); f.dom.window.close(); }
});

test("workflow CSS follows the life of every open native workflow", async () => {
  const f = fixture();
  f.document.body.insertAdjacentHTML("beforeend", '<span hidden data-bb-chat-ui-device="desktop"></span>');
  const shell = f.document.querySelector<HTMLElement>('[data-promptbox-shell]')!;
  const secondShell = shell.cloneNode(true) as HTMLElement;
  shell.parentElement!.append(secondShell);
  const shells = [shell, secondShell];
  const nativeChecks: string[] = [];
  for (const [index, item] of shells.entries()) {
    const stack = item.querySelector('.grid')!;
    const card = f.document.createElement('section'); card.setAttribute('aria-label', 'Workflow');
    card.innerHTML = `<button aria-expanded="false" aria-controls="wf-${index}">Workflow</button><section role="region" id="wf-${index}" hidden><div data-detail-scroll-area>Phase</div></section>`;
    const toggle = card.querySelector<HTMLButtonElement>('button')!;
    toggle.addEventListener('click', () => {
      const style = f.document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info-workflow');
      nativeChecks.push(`${!!style?.isConnected}:${card.getAttribute('data-bb-chat-ui-info-open')}`);
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      card.querySelector<HTMLElement>('[role="region"]')!.hidden = !expanded;
    });
    stack.append(card);
  }
  await f.tick();
  const stop = injectComposerInfo(f.document);
  try {
    const prefix = f.document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info')!;
    const suffix = f.document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info-tail')!;
    assert.equal(f.document.querySelector('#bb-chat-ui-composer-info-workflow'), null);
    assert.equal(prefix.nextElementSibling, suffix);
    const stacks = shells.map(item => item.querySelector<HTMLElement>('.grid')!);
    // Open one workflow through the product pill.
    const openWorkflow = (stack: HTMLElement) => stack.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-trigger="workflow"]')!.click();
    // Close one workflow through its native-card dismiss button.
    const closeWorkflow = (stack: HTMLElement) => stack.querySelector<HTMLButtonElement>('[data-bb-chat-ui-info-native-dismiss]')!.click();
    openWorkflow(stacks[0]);
    const sheet = f.document.querySelector<HTMLStyleElement>('#bb-chat-ui-composer-info-workflow')!;
    assert.ok(sheet?.isConnected); assert.equal(nativeChecks[0], 'true:workflow', 'CSS is connected before native click');
    assert.equal(prefix.nextElementSibling, sheet); assert.equal(sheet.nextElementSibling, suffix);
    assert.equal(prefix.textContent! + sheet.textContent! + suffix.textContent!, composerInfoCss, 'all rules retain original order and text');
    openWorkflow(stacks[1]); assert.equal(sheet.isConnected, true);
    closeWorkflow(stacks[0]); assert.equal(sheet.isConnected, true, 'another stack keeps workflow CSS active');
    const editor = f.document.createElement('div'); editor.setAttribute('data-queued-message-inline-editor', ''); stacks[1].append(editor);
    closeWorkflow(stacks[1]); assert.equal(sheet.isConnected, true, 'editing refuses close without deactivating');
    editor.remove(); closeWorkflow(stacks[1]); assert.equal(sheet.isConnected, false);
    const hover = stacks[0].querySelector<HTMLElement>('[data-bb-chat-ui-info-trigger="workflow"]')!;
    pointer(f, "pointerover", hover); await new Promise(resolve => f.dom.window.setTimeout(resolve, 230));
    assert.equal(sheet.isConnected, true, "hover preview activates workflow CSS");
    pointer(f, "pointerout", hover, f.document.body); await new Promise(resolve => f.dom.window.setTimeout(resolve, 190));
    assert.equal(sheet.isConnected, false, "ending the hover preview releases workflow CSS");
    openWorkflow(stacks[0]); assert.equal(sheet.isConnected, true, 'reopening activates synchronously');
    shell.remove(); await f.tick(); assert.equal(sheet.isConnected, false, 'removing an open stack releases its CSS');
    openWorkflow(stacks[1]); assert.equal(sheet.isConnected, true);
    stop(); assert.equal(f.document.getElementById(sheet.id), null, 'cleanup removes all style nodes');
    assert.equal(f.document.getElementById(prefix.id), null); assert.equal(f.document.getElementById(suffix.id), null);
  } finally { stop(); f.dom.window.close(); }
});

test("closed workflows leave no workflow stylesheet connected", () => {
  const f = fixture(), stop = injectComposerInfo(f.document);
  try {
    assert.equal(f.document.querySelector('#bb-chat-ui-composer-info-workflow'), null, 'closed workflow has no connected rules');
  } finally { stop(); f.dom.window.close(); }
});
