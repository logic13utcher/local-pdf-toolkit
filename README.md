# Local PDF Toolkit

> 업로드 없이 **브라우저 안에서만** 처리하는 PDF 편집기. 파일이 서버로 전송되지 않습니다.
> A privacy-first, fully client-side PDF toolkit. Files never leave the browser.

[**▶ 라이브 데모**](https://USERNAME.github.io/local-pdf-toolkit/) <!-- 배포 후 URL로 교체 -->

무료 온라인 PDF 도구 대부분은 파일을 자기 서버로 업로드받아 처리합니다. 이 프로젝트는 모든 처리를
브라우저(클라이언트)에서 수행하므로 인증서·계약서 같은 민감 문서를 외부로 보내지 않습니다.

---

## 기능

| 탭 | 기능 |
|----|------|
| **이미지 → PDF** | 여러 이미지(JPG/PNG/WEBP/GIF)를 한 PDF로 병합, 순서 변경, 페이지 크기(원본 비율 / A4 / Letter) 선택 |
| **전자서명** | 서명 이미지를 PDF 위에 배치(드래그·리사이즈), **흰 배경 자동 제거** — 배경/잉크색을 추정해 알파를 역산하는 매팅 방식으로 깔끔한 투명 처리 |
| **편집 · 정렬** | 여러 PDF 병합, 페이지 드래그 재정렬(긴 목록 자동 스크롤), 삭제/복원, **회전(90°)**, **흰색 가리기(드래그)**. 수백 페이지 대응을 위해 썸네일을 렌더하지 않고 목록 + 온디맨드 단일 미리보기로 동작 |

## 설계 포인트

- **Zero-upload**: 서버·백엔드 없음. `File` → `ArrayBuffer` → pdf-lib/pdf.js로 브라우저 내 처리.
- **대용량 전략**: 페이지 수에 따라 렌더링 비용이 폭증하는 썸네일 그리드 대신, 편집 탭은 경량 목록 + 클릭 시 1장만 렌더 → 수백 페이지에서도 메모리 안정.
- **서명 배경 제거(매팅)**: 모서리에서 배경색 B, 휘도 하위 구간에서 잉크색 F를 추정 → 각 픽셀을 B→F 직선에 투영해 혼합비 α를 구하고, 색은 순수 잉크색·알파만 α로 출력. 거리 임계값 방식보다 가장자리가 선명.
- **라이브러리 로컬 우선 + CDN 폴백**: `./lib`에 라이브러리가 있으면 완전 오프라인, 없으면 CDN 자동 사용.

## 기술 스택

Vanilla JavaScript (빌드 도구 없음) · [pdf-lib](https://pdf-lib.js.org/) (쓰기/병합/회전) · [pdf.js](https://mozilla.github.io/pdf.js/) (렌더/텍스트) · Canvas 2D (서명 매팅, 가리기) · 정적 호스팅

## 사용법

**이미지 → PDF**
1. 이미지 여러 장을 끌어다 놓거나 클릭해 선택
2. 카드를 드래그해 순서 조정, 페이지 크기(원본 비율 / A4 / Letter) 선택
3. **PDF 만들기**

**전자서명**
1. 서명할 PDF를 불러오기
2. 왼쪽에서 **＋ 서명 추가**로 서명 이미지(PNG/JPG) 등록 — 흰 배경은 자동으로 투명 처리됨
3. 서명을 고른 뒤 페이지의 원하는 위치를 **클릭**해 배치 → 드래그로 이동, 모서리 점으로 크기 조절
4. **서명 적용해 내보내기**

**편집 · 정렬**
1. PDF를 하나 이상 불러오기(여러 개면 자동으로 이어붙음)
2. 줄을 클릭하면 오른쪽에 그 페이지가 크게 보임 — 거기서 **회전**, **지우개(흰색 가리기)** 가능
3. 줄을 드래그해 순서 변경, **삭제**로 제외(긴 목록은 가장자리에서 자동 스크롤)
4. **PDF 내보내기**

> 스크린샷: 배포 후 각 탭 화면을 캡처해 `docs/` 폴더에 넣고 이 자리에 링크하면 됩니다.
> 예) `![편집·정렬 탭](docs/edit-tab.png)`

## 안전성 — 왜 파일이 안전한가

- **파일이 서버로 전송되지 않습니다.** 모든 처리는 브라우저 안에서만 수행됩니다.
- **직접 검증 가능:** 브라우저 개발자도구(F12) → Network 탭을 켠 채로 파일을 처리해도 파일이 전송되지 않습니다.
- **오픈소스:** 전체 코드가 공개되어 동작을 직접 확인할 수 있습니다.
- **광고 없음 · 계정 없음 · 설치 없음.**

인증서·계약서·신분증처럼 외부에 올리기 꺼려지는 문서를 다룰 때 적합합니다.

## 로컬 실행

```powershell
# 1) 라이브러리 받기 (프로젝트 루트, PowerShell)
New-Item -ItemType Directory -Force lib | Out-Null
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js   -OutFile lib/pdf-lib.min.js
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js        -OutFile lib/pdf.min.js
Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js -OutFile lib/pdf.worker.min.js
```

그다음 `index.html`을 더블클릭하면 됩니다. (라이브러리를 안 받아도 인터넷이 있으면 CDN으로 동작합니다.)

> 참고: `file://`로 직접 열면 pdf.js worker가 메인 스레드 폴백으로 동작해 다소 느릴 수 있습니다.
> 더 빠르게 보려면 간단한 로컬 서버 사용을 권합니다: `python -m http.server` 후 http://localhost:8000

## 배포 (GitHub Pages)

1. 이 폴더를 GitHub 저장소로 푸시
2. 저장소 **Settings → Pages → Source: `main` 브랜치 / `/ (root)`** 선택
3. 잠시 후 `https://USERNAME.github.io/local-pdf-toolkit/` 에서 접속

대안: **Cloudflare Pages** — GitHub 저장소 연결 후 빌드 명령 없이 정적 배포(빌드 출력 디렉터리 `/`).

## 한계 (정직하게)

- **"가리기"는 흰색 사각형으로 덮는 것이며 내용 삭제가 아닙니다.** 가려진 영역의 원본 텍스트/이미지는 PDF 안에 그대로 남아 추출·복원될 수 있습니다. **민감정보의 보안 삭제(redaction) 용도로 쓰지 마세요.**
- 서명 배경 제거는 **단색 잉크** 가정입니다. 여러 색이 섞인 도장/로고는 한 색으로 합쳐질 수 있습니다(이 경우 토글을 끄고 투명 PNG 사용).
- 회전된 페이지에 대한 서명 좌표 매핑은 회전 0° 기준에서 정확합니다.
- 수천 페이지·초고해상도 스캔은 브라우저 메모리 한계에 도달할 수 있습니다(이 경우 로컬 PyMuPDF 등 네이티브 처리가 적합).

## 라이선스

[MIT](./LICENSE)
