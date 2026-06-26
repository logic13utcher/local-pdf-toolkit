이 폴더에는 외부 라이브러리 3개가 들어가야 합니다 (git에는 커밋하지 않아도 됨 — CDN 폴백이 동작).

필요 파일:
  pdf-lib.min.js        (pdf-lib 1.17.1)
  pdf.min.js            (pdf.js 3.11.174)
  pdf.worker.min.js     (pdf.js 3.11.174 worker)

다운로드 (PowerShell, 프로젝트 루트에서 실행):
  Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js   -OutFile lib/pdf-lib.min.js
  Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js        -OutFile lib/pdf.min.js
  Invoke-WebRequest https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js -OutFile lib/pdf.worker.min.js

세 파일이 있으면 완전 오프라인으로 동작합니다. 없으면 자동으로 CDN에서 불러옵니다(인터넷 필요).
