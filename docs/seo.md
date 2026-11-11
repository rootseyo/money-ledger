# 검색 노출 설정

## 구현된 항목

- 익명 방문자의 `/` 요청은 HTTP 200으로 서비스 소개를 서버 렌더링한다. `/login`도 같은 대표 주소 `/`를 canonical로 사용한다.
- 로그인한 `/` 장부와 `/workspace`에는 `X-Robots-Tag: noindex, nofollow, noarchive`와 `Cache-Control: private, no-store`를 적용한다. API 응답도 검색에서 제외한다. 인증·화면 잠금은 유지된다.
- `/signup`은 `noindex, follow`이며 사이트맵에 넣지 않는다.
- 페이지별 제목·설명·canonical·Open Graph·Twitter 카드를 공통 함수로 관리한다. 실제 번역 페이지가 없는 영문 hreflang은 선언하지 않는다.
- 홈페이지 HTML에 WebSite, WebPage, Organization, WebApplication JSON-LD를 제공한다. 확인되지 않은 요금이나 평점은 선언하지 않는다.
- 네이버 인증 메타태그는 초기 HTML의 `<head>`에 출력한다. 인증값은 공개 메타 정보이며 비밀키가 아니다.
- `public/og-ledger.png`는 1200×630 PNG 공유 이미지다. 앱 아이콘은 SVG·32px PNG·180px Apple PNG를 제공한다. 이미지 URL은 로그인 없이 접근할 수 있다.
- 사이트맵은 공개 대표 주소와 약관·개인정보 페이지만 포함한다. lastModified는 실제 문서 변경에 맞춰 수정하고 빌드할 때마다 갱신하지 않는다.
- Next.js 기본 htmlLimitedBots에 Yeti가 포함돼 있어 네이버 수집기는 메타데이터가 준비된 HTML을 받는다.

## 확인

```sh
npm test
npm run build
node scripts/check-seo.mjs http://localhost:4013 --local-auth
node scripts/check-seo.mjs https://your-domain.com
```

`--local-auth`는 로컬 주소에서만 동작하며 `.env`의 JWT 키로 일회성 합성 세션을 만들어 장부 응답의 캐시·검색 제외 헤더를 검사한다. 실제 사용자 데이터를 조회하지 않는다. 운영 점검에서는 이 플래그를 사용하지 않는다.

공유 이미지 재생성은 macOS에서 `node scripts/generate-seo-images.mjs`로 수행한다. 한국어 글꼴이 있는 환경에서 PNG 결과를 확인한다. 운영 서버는 생성된 PNG 파일을 제공하므로 글꼴 다운로드가 필요 없다.

## 네이버 계정에서 완료할 항목

1. 서치어드바이저에서 배포된 도메인(`https://your-domain.com`)의 **소유확인**을 완료한다. 코드에 인증값이 있는 것과 네이버 계정에서 확인이 완료된 것은 별개다.
2. **요청 → 사이트맵 제출**에 `https://your-domain.com/sitemap.xml`을 제출한다.
3. **URL 검사**에서 대표 주소의 수집·색인 상태를 확인한다. 배포나 소유확인만으로 즉시 검색 노출이 보장되지는 않는다.

공식 문서: [사이트 등록 및 소유확인](https://searchadvisor.naver.com/guide/faq-start-register), [RSS 및 사이트맵 제출](https://searchadvisor.naver.com/guide/request-feed), [URL 검사](https://searchadvisor.naver.com/guide/url-inspection).
