# QSystem P1/P2 UX refinement contract

Date: 2026-11-15 (Asia/Saigon)  
Governance task: `ux-p1-p2-refinement`  
Harness run: `04681ad5-afb6-4f5e-b54e-18e0513b4248` / work item `discovery`  
Owner: `product-manager`  
Discovery budget: 24,000 tokens; provider token/turn totals are not exposed.

## Outcome and authority

Vietnamese internal operators must be able to navigate, scan work and people, and recover from a failed request using the keyboard or a narrow browser. This is an Operate-mode refinement of the shipped web app. Preserve routes, business rules, permissions, API payloads, factual content, theme persistence, and public `@qsystem/ui` exports. Add only compatible optional props when necessary.

The visual and language authorities remain [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and the [reference kit](../../design/references/README.md). This task supplements the [existing UI specification](2026-11-14-qsystem-ui-ux-design.md); it does not replace the product or its design system. Existing unrelated working-tree changes belong to their current owners.

Constitution and stage order: [Harness constitution](../../harness/CONSTITUTION.md) -> specify -> architect-owned plan -> named frontend implementation -> independent review and verification -> tasks. The existing global constitution acceptance is recorded in the append-only ledger; the current constitution was also read in the injected context and on disk. The prior `ux-engineering-ui-improvement` specify/plan records remain intact. This narrower contract gets its own task ID so its criteria can be recorded without replacing those records.

## Direction and constraints

- **Product:** one Vietnamese workspace for task, staff, document, notification, and internal-feed operations.
- **Character:** calm, exact, fast to scan.
- **World:** the existing graphite console and Warm Paper workspace.
- **Moments:** task selection/detail and a clear primary action; semantic status color retains its meaning.
- **Signature:** consistent Vietnamese labels, restrained keyboard hints, and aligned tabular task codes and dates.

Use Hallmark's app scope, Impeccable's existing-world hardening guidance, Unslop's polish pass, and ios-design's transferable interaction/accessibility checks. Unslop is by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0. Its generic font/radius/spacing suggestions yield to QSystem's locked system. Hallmark's marketing/hero rules do not apply. Wayfinder's issue-map workflow yields to the repository's ordered Harness task tracking; no extra tracker or glossary is introduced.

Keep Inter 400/500/600, Vietnamese glyphs, tabular numerals, canonical Dark/Warm Paper/Amber tokens, neutral selection, 6px controls, 8px floating panels, and the existing spacing scale. Keep one primary amber CTA per screen and the Q brand mark; use the documented focus/tab tokens for their assigned purposes. Static surfaces have no shadow. Do not introduce decorative glass, blur treatments, native iOS APIs, a new UI kit, animation dependencies, speculative metrics, or replacement factual copy. Liquid Glass is a review lens only: readability, separation of navigation/content, and accessibility.

Motion decision: retain only existing feedback that explains state; no entrance choreography is needed. Keep targeted 150ms feedback where already appropriate, immediate focus indication, and static pending feedback under reduced motion. No `transition: all` or animated layout dimensions.

Fragment UI is the sole enabled UI reference provider; Kibo is disabled. `.mcp.json` configures Fragment UI, but this discovery session exposes no callable Fragment UI MCP tools. No primitive is created in discovery. Before any new primitive, block, or page pattern, the frontend owner must search the actual server, inspect the closest match, and record query, result, and reuse/no-match reason. Reuse the existing UI package for the fixes below. An unavailable server is not evidence of a no-match.

## Evidence and prioritization

Source observations below were checked on 2026-11-15. They are not fresh browser reproductions. All three reference JPGs were viewed directly, along with historical `.playwright-mcp/ux7/tasks-1024-dark.png` and `tasks-390-light.png`. Those captures are visual context, not current-build pass evidence: current source and API integrations have changed since capture.

P1 means primary navigation/task access can fail or a modal keyboard user can escape into obscured content. P2 means a recoverable operation gives misleading state, permits duplicate writes, or fails the required interaction/language contract. Both priorities must be resolved before release; P3 is optional refinement or separate feature work. A current browser reproduction may refine a finding, but disproving one requires attached evidence, not a silent omission.

| ID | Priority | Current evidence | Required outcome |
| --- | --- | --- | --- |
| UX-01 | P1 | `packages/ui/src/unified-shell.tsx:18` uses desktop `>=1024`; `packages/ui/src/styles.css:335` hides the fixed sidebar at `<=1024`. The toggle is absent from desktop DOM. | At exactly 1024px the fixed 240px sidebar remains visible. Below 1024px a working drawer trigger replaces it. JS and CSS agree through resize. |
| UX-02 | P1 | `unified-shell.tsx:48`–52 focuses the mobile panel without trapping or restoring focus. `command-palette.tsx` declares a modal without a Tab boundary; modal/drawer components each attach independent traps. | Only the top modal owns focus containment. Tab/Shift+Tab cannot reach obscured content. Opening nested layers, closing them, and breakpoint transitions restore valid focus without competing traps. |
| UX-03 | P1 | `apps/web/src/app/(workspace)/account/page.tsx:31` suppresses load failure; line 76 renders loading whenever `me` is absent. | A non-authentication load failure ends loading and presents Vietnamese explanation + retry; a successful retry renders the profile. Preserve expired-session handling and the existing password-change/logout behavior. |
| UX-04 | P2 | `apps/web/src/app/(workspace)/files/page.tsx:52` swallows list errors; line 119 treats unresolved/failed empty rows as an empty result. | Separate initial loading, successful empty, populated, and recoverable failure. Keep upload/open feedback local to the operation and keep any already loaded files accessible. |
| UX-05 | P2 | `GlobalCommandHost.tsx:80` maps failed search to `hits=[]`; `CommandPalette` exposes loading/empty but no explicit error path. | Distinguish failed search from a successful zero-result query, offer retry for the current query, and preserve current navigation groups, debounce, IME behavior, and result destinations. |
| UX-06 | P2 | `notifications/page.tsx:68` renders an initial error without retry; line 96 has no rejection/pending feedback for `markRead`. Later polling failures are not surfaced with existing items. | Explicit retry, non-destructive refresh-failure feedback, and per-item pending/error feedback for mark-read; no unhandled rejection or false read confirmation. Preserve polling visibility policy and automatic mark-all-read on entry. |
| UX-07 | P2 | `QTaskWorkspace.tsx` has no pending guard in `completeSelected`; `TaskDetailFooter` disables only completed tasks. Inline status saving is managed separately. | Repeated activation cannot duplicate the same in-flight mutation. Status and completion controls targeting the same task cannot send conflicting concurrent writes; failure preserves current task data and allows retry. |
| UX-08 | P2 | `AppWorkspaceShell.tsx` provides a theme `title` but no semantic toggle state; its account menu declares `role=menu` without focus/arrow-key management. `toast.tsx:185` uses English `Dismiss notification`. | Expose theme state, make account menu keyboard behavior match its declared semantics, and use Vietnamese toast dismissal labeling. Preserve existing default toast dismissibility, timing, pause/resume, and stacking. |
| UX-09 | P2 | Top-bar unread badge uses `--qs-brand` (`globals.css:289`), competing with the primary CTA. Account profile values have no long-value wrapping (`globals.css:651`–653); drawer close is a 32px target (`styles.css`). | Keep unread count neutral and comprehensible; keep chrome inside the 56px bar; ensure long values, controls, and focus remain reachable at narrow widths with usable touch hit areas. No visual redesign. |

Backlog reconciliation: [ui-backlog.md](../../harness/ui-backlog.md) is historical. Task listing now requests `/api/org/tasks` and propagates failures; QHRM has `CreateUserModal` and POST creation tests; files already request `/api/files`; toast already renders a dismiss button. Do not reintroduce localStorage task fallback, fake staff creation, a fabricated file-list endpoint, or another toast close control. The actionable toast issue here is its accessible language; changing `closeButton` semantics is separate compatibility work.

## UI states and transitions

Apply this contract to the affected existing data regions; verify already-correct QTask/QHRM/QSocial states rather than rebuilding them.

| Region/operation | Loading/pending | Successful empty or ready | Failure and recovery |
| --- | --- | --- | --- |
| Account profile | Named status/skeleton, no endless spinner | Profile; preserve password and logout flows | Inline error + `Thử lại`; retry does not resubmit credentials or a password change. Authentication expiry keeps its existing route. |
| File list | Skeleton for the list request, distinct from upload/open | Honest empty guidance only after a successful zero-row response; otherwise list | Retry list request; initial failure is not empty. Retain rows if a later refresh fails. |
| File upload/open | Visible, accessible operation-specific pending state; prevent repeated activation for the same operation | Add a file only after successful upload; open retains its existing destination | Humanized error tied to the action; existing files remain usable. Preserve the picker/open workflow. |
| Global search | Current-query loading; retain existing debounce | Zero results is a successful search state; existing static navigation/actions keep their current behavior | Failure message and reachable retry for the same query. Ignore stale responses after query changes or dismissal. |
| Notifications | Named loading, separate read-operation pending | Preserve unread/read labels and visibility-aware polling | Initial error + retry; background failure keeps rows with a recovery message; failed read leaves that item unread and can be retried. |
| Task status/completion and existing create forms | Busy indication; block repeated/conflicting writes for the same entity | Update data and confirm only after success | Keep valid input/current data and re-enable the action. Do not change backend semantics. |

Loading status uses `role=status`/`aria-busy` where appropriate; errors are announced once near their region/action. Avoid repeated screen-reader alerts on every poll. A settled failed request must leave pending state. Retry clears the stale error for the new attempt, deduplicates in-flight requests, and cannot overwrite a newer success. Do not invent new timeouts or offline storage policy; preserve the existing API-client seam.

## Acceptance criteria

1. **Layout:** No document horizontal overflow, overlap, or unreachable action at 1440x900, 1024x768, and 390x844 in both themes at 100% zoom. The fixed sidebar exists at 1024px; drawer navigation is available below it. Detail is 390px inline at `>=1280px`, overlay below. Closing inline detail restores table width. Locally scrollable tables may retain their current responsive policy, but all essential information/actions remain accessible; clipping the document is not a substitute for fixing layout.
2. **Boundaries and content:** Check 1023/1024/1025px and 1279/1280px transitions with layers open, long task titles, long emails/file names, large unread counts, and the string `Nguyễn Minh Tuấn, Trễ hạn, Tổ chức & Nhân sự`. Keep normal table rows at the existing 44–48px density; allow content reflow when text is enlarged. Short/tall overlay viewports and a mobile browser keyboard must leave the focused field, close control, and required action reachable. Verify 200% browser zoom separately from the mandatory 100% screenshots; input text must avoid unwanted mobile focus zoom.
3. **Keyboard layers:** Every interactive element has visible immediate focus. Test the mobile navigation drawer, detail drawer, palette, create dialog, module/filter/account menus, and a nested combination. Esc closes exactly one top layer; the last locking layer restores the original body overflow. Focus returns to the invoking control or a meaningful visible fallback if it unmounted. Top modal Tab/Shift+Tab stays contained; non-modal popovers remain navigable without capturing the whole page. No lower focus trap steals focus from a higher layer, and keyboard order matches visual layer order.
4. **Keyboard regression:** Ctrl/Cmd+K still skips editable fields and Vietnamese IME composition. J/K and arrow movement, Enter/Space row activation, child-control opt-out, and existing table sort/selection semantics still work. Account menu uses appropriate keyboard behavior for its retained semantic pattern. Theme state is exposed through a consistent accessible name/state.
5. **Async:** Demonstrate initial loading -> ready, successful empty, rejected request -> error -> retry -> ready, and retry failure for UX-03 through UX-06. Exercise delayed/out-of-order responses, unmount/dismiss, mutation rejection, and rapid double activation for changed paths. Preserve draft input and existing successful data on failure. No raw API codes, fake success, unhandled promise rejection, or error masquerading as empty.
6. **Accessibility and motion:** Text contrast meets the product's 4.5:1 threshold; large text/focus use at least 3:1 in both themes. State is understandable without color. All labels, including ARIA and toast dismiss controls, use natural Vietnamese. Small icon artwork can stay at its current size while the mobile hit region reaches 44x44px without overlapping neighboring targets. Reduced motion disables animations, transitions, and press transforms while pending state remains understandable. Test actual computed styles with media emulation, not only CSS text.
7. **Visual contract:** Reuse tokens; preserve Inter and Vietnamese glyphs; align table columns, dates, and counts; use neutral row selection and badge treatment. One primary amber CTA per screen; no static shadows, decorative glass, new hero treatment, or redundant containers. Hallmark `--scope app --genre modern-minimal --render` must actually run with zero FAIL; document/fix valid REFLEX findings and justify any permitted waiver.
8. **Delivery:** Every UX ID has a resolution and evidence link, or an evidence-backed disproval approved in independent review. Report changed files, test commands/exit codes/counts, current screenshots, Fragment decisions, and remaining P3 items. Missing browser/render/review evidence blocks release even when unit tests pass. Discovery completion alone is not an implementation or shipping pass.

## Ownership, likely files, and verification handoff

`chief-architect` owns the component seams, compatible optional APIs, focus-stack design, risks, and plan. Every code card must be owned by `frontend-engineer` through `corepack pnpm harness implement --agents .harness/agents.json`; use the governance task ID above for the new contract's plan. An already-running Harness agent must complete its assigned work item rather than recursively launching the whole delivery workflow. `tester` supplies typed `test-results`, `qa-browser-engineer` owns interactive browser evidence, and `independent-reviewer` reviews the final diff against this contract. Merge authority remains with the integrator/human gates. No issue publication before implementation evidence.

Likely implementation files, subject to the architect's smallest justified plan:

- Shared behavior/styles: `packages/ui/src/{unified-shell,layer,modal,responsive-detail-drawer,command-palette,toast}.tsx` (the layer source is `layer.ts`), `styles.css`; existing `FilterPopover`, `ModuleSwitcher`, `StateRegion`, `Button`, and `Input` are reuse candidates. Only extend additional primitives where a reproduced finding requires it.
- App callers: `apps/web/src/components/shell/AppWorkspaceShell.tsx`, `components/search/GlobalCommandHost.tsx`, `components/qtask/{QTaskWorkspace,TaskDetailContent}.tsx`, and workspace `account`, `files`, `notifications` pages; `apps/web/src/app/globals.css`. Read the immediate adapters/client before altering request handling. Do not edit backend/contracts/dependency configuration for this pass.
- Regressions: existing UI `layer`, `modal`, `drawer-cmdk`, `shell-primitives`, and `toast` tests; existing web `app-shell`, `command-palette`, `qtask`, and `notifications` tests. Add focused `account-page.spec.tsx` and `files-page.spec.tsx` tests under `apps/web/test` for the uncovered recovery paths. Extend browser tests under `apps/web/e2e`; keep current live-persistence tests intact.

Tests must prove user outcomes: no navigation dead end at the boundary, focus stays in and returns from the right layer, retry invokes the correct request without losing data, stale results are ignored, and rapid activation produces one write. Do not add snapshots or CSS-string checks that merely mirror implementation. Where a deterministic seam exists, capture focused RED then GREEN evidence for the changed behavior.

Required commands for downstream verification (not executed during this discovery-only card):

```text
corepack pnpm --filter @qsystem/ui test
corepack pnpm --filter @qsystem/ui typecheck
corepack pnpm --filter web test
corepack pnpm --filter web typecheck
corepack pnpm --filter web build
corepack pnpm --filter web exec playwright test
corepack pnpm exec node C:/Users/buiho/.agents/skills/hallmark/scripts/sloplint.mjs apps/web/src packages/ui/src --scope app --genre modern-minimal --render --url http://127.0.0.1:3000/
```

The current Playwright config requires a running app; live tests require seeded services and `E2E_PASSWORD` from the environment. Never print credentials or weaken authentication to make a render pass. Use deterministic request fixtures for async failures, and retain live persistence coverage separately. Authenticate the rendered Hallmark context for protected pages; a capture of the login redirect does not verify a workspace route. Record routes, viewport, theme, zoom, state, tool versions, and actual screenshot paths. Run the local Harness tester according to the registry after each `verifyAfter` card; its default suite alone does not prove web interaction quality. The independent review must be a separate owner's result after implementation, followed by the repository's separate debugging/verification-before-completion pass.

## Remaining P3 and non-goals

| Item | Boundary for this pass |
| --- | --- |
| Top-bar avatar/name presentation | Optional identity polish; existing account identity remains accessible. Do not fabricate an avatar. |
| QHRM job-title/employment-state fields | Current directory displays honest missing-data text. New API/schema fields are separate work. |
| Department/attendance destinations | Existing query destinations need their own product scope; do not implement new modules or silently remove navigation in a refinement. |
| Task discussion/attachment capabilities | Preserve honest empty content until an approved backend/product feature exists. |
| Due-time presentation | Do not infer a time from a date-only value or alter deadline semantics. |
| Generic column-width API and scroll-edge decoration | Separate optional component work after responsive access is correct; no new abstraction merely to polish this pass. |
| Session-context deduplication and broader optimization | Optional architecture work unless necessary for a reproduced recovery/focus fix. |
| Toast `closeButton` opt-out behavior | Separate compatibility decision; keep the currently tested default close behavior and fix the Vietnamese label here. |

Before final implementation handoff, reconcile `docs/harness/ui-backlog.md`: remove resolved/stale entries, move the UX-01–09 findings out of P3, and attach evidence to the genuine remaining backlog. Do not claim the historical assertion that all listed items are non-blocking still holds. Discovery changes only this spec and its Harness specify ledger record; no application/UI source, tests, or existing backlog has been changed by this work item.
