# 팀 돌림판

모바일 웹뷰와 GitHub Pages에서 바로 실행할 수 있는 정적 웹 미니게임입니다.

## 기능

- 그룹 추가, 삭제, 이름 변경
- 그룹 안 이름 추가, 삭제, 이름 변경
- 체크박스로 그룹 전체 참가/제외
- 체크박스로 개인별 참가/제외
- 참가 중인 이름만 돌림판에 반영
- 돌림판 시작 후 다시 누르면 정지
- 당첨 기록 저장
- 당첨 당시 참가 인원, 확률, 카페 비용 예상 금액 표시
- 이번 주, 이번 달, 전체 당첨 횟수와 비율 표시
- 현재 참가자 기준 기대 확률 표시
- 전체 기록 초기화 시 팀과 이름 유지
- 개인별 당첨 기록 삭제
- 개별 당첨 기록 삭제
- 현재 설정을 브라우저에 자동 저장
- 공유 버튼으로 URL hash에 설정 저장
- 당첨자에게 보낼 감사 메시지 공유

## 실행

로컬에서 확인하려면 프로젝트 폴더에서 실행합니다.

```bash
python -m http.server 4173
```

브라우저에서 엽니다.

```text
http://127.0.0.1:4173
```

## 확률 로직 확인

확률 계산은 `probability.js`의 `WheelProbability` 클래스에 분리되어 있습니다.
브라우저 콘솔에서 아래처럼 확인할 수 있습니다.

```js
const state = JSON.parse(localStorage.getItem("team-wheel-state-v1"));
const entries = WheelProbability.getEligibleEntries(state.groups);
WheelProbability.getEqualOdds(entries);
```

현재 구조는 참가 중인 사람 모두 동일 가중치 `1`입니다.

## GitHub Pages 배포

1. GitHub 저장소를 만듭니다.
2. 이 폴더의 `index.html`, `styles.css`, `game.js`, `README.md`를 push합니다.
3. 저장소 `Settings` > `Pages`에서 `main` branch와 `/root`를 선택합니다.
4. 발급된 GitHub Pages 주소로 접속합니다.
