# Codex 주간 사용률 감시

이 감시는 `bb-usage`의 강제 조회에서 지정된 host의 Codex `Weekly limit`을 사용한다. 같은 host에 주간 창이 여러 개면 가장 높은 사용률과 그 창의 초기화 시각을 선택한다. 이 값은 서버가 제공하는 주간 한도 사용률이며 토큰 개수가 아니다. 인증 파일을 직접 읽지 않는다.

`BB_CLI`는 실제 BB Node entry의 절대 경로여야 한다. Node 프로세스가 쉘 없이 이를 실행한다. `BB_THREAD_ID`, `BB_PROJECT_ID`, `BB_THREAD_STORAGE`는 감시할 부모 BB 스레드의 환경을 사용한다. `BB_USAGE_HOST_ID`에는 `bb status --json`에서 확인한 해당 host ID를 지정한다. 이 값과 실제 상태 파일은 git에 넣지 않는다. 준비된 환경에서 다음 명령을 사용한다.

```powershell
node scripts/monitor-codex-weekly.mjs --once
node scripts/monitor-codex-weekly.mjs --dry-run
node --test scripts/monitor-codex-weekly.test.mjs
```

`--once`는 사용률만 조회한다. `--dry-run`은 중단하지 않고 현재 대상 thread ID도 표시한다. `--watch`는 별도 프로세스로 실행할 때만 사용한다. 기본 간격은 60초이며 75% 이상 또는 확인 실패 시 12초다. 수집 시각은 RPC 응답에 없으므로 강제 조회가 30초를 넘거나 초기화 시각이 지났으면 unknown으로 처리한다. 이것만으로 서버가 반환한 캐시의 실제 나이를 증명할 수는 없다.

상태와 잠금 파일은 부모 thread storage의 `quota-monitor/`에 둔다. 부모는 새 작업을 시작하기 전에 `state.json`의 `allowNewWork`가 `true`이고 `heartbeatAt`이 현재 시각에서 105초 이내인지 확인해야 한다. 파일이 없거나 오래되었거나 읽을 수 없으면 새 작업을 시작하지 않는다. 조회가 세 번 연속 실패하면 부모에게 복구를 요청한다. 80%에 도달하면 latch를 저장하고 부모를 제외한 BB 후손 중 Codex thread만 중단한다. 숨긴 thread와 다른 provider 아래의 Codex 후손도 포함한다. 요청한 부모가 프로젝트 목록에 없으면 중단 범위를 검증하지 못한 실패로 기록한다. 후손의 중단 요청은 함께 시작하고, 결과를 모아 저장한다. 실패한 중단과 명시적으로 실패한 알림은 다음 주기에 재시도한다. 알림 전송 중 프로세스가 종료되면 `attempted`가 남고 다음 실행에서 다시 전송한다. 중단 목록 조회와 개별 결과는 상태 파일에서 확인한다.

Latch는 재시작 후에도 유지되며 자동으로 해제되지 않는다. 80% 알림은 후손 중단을 기다리지 않고 시작하며 상태 파일 저장은 직렬로 실행한다. 전송 중 종료된 `attempted` 알림은 재시작 후 재시도하므로 부모가 중복 알림을 받을 수 있다. watcher가 비정상 종료되면 `watcher.lock`이 남을 수 있다. 프로세스가 실제로 종료된 것을 확인한 뒤에만 잠금 파일을 수동으로 제거한다. 이 스크립트는 native collaboration agent를 제어하지 않는다.
