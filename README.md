# 팀 복불복 돌림판

모바일 웹뷰와 GitHub Pages에서 바로 실행할 수 있는 정적 웹 미니게임입니다.

## 기능

- 그룹 추가, 삭제, 이름 변경
- 그룹 안 이름 추가, 삭제, 이름 변경
- 그룹 전체 참가/제외
- 개인별 참가/제외
- 참가 중인 이름만 돌림판에 반영
- 현재 설정을 브라우저에 자동 저장
- 공유 버튼으로 URL hash에 설정 저장

## 실행

로컬에서 확인하려면 프로젝트 폴더에서 실행합니다.

```bash
python -m http.server 4173
```

브라우저에서 엽니다.

```text
http://127.0.0.1:4173
```

## GitHub Pages 배포

1. GitHub 저장소를 만듭니다.
2. 이 폴더의 `index.html`, `styles.css`, `game.js`, `README.md`를 push합니다.
3. 저장소 `Settings` > `Pages`에서 `main` branch와 `/root`를 선택합니다.
4. 발급된 GitHub Pages 주소로 접속합니다.
