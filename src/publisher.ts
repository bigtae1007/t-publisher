import {chromium, BrowserContext, Page} from "playwright";
import fs from "fs";
import {downloadAuthFromS3, uploadAuthToS3} from "./s3";

/**
 * 🔥 메인 실행 함수
 */
export async function publishToTistory(title: string, content: string) {
    const browser = await chromium.launch({headless: false});

    await downloadAuthFromS3();
    const context = fs.existsSync("auth.json")
        ? await browser.newContext({storageState: "auth.json"})
        : await browser.newContext();


    const page = await context.newPage();

    await page.goto("https://tistory.com");

    // 4️⃣ 로그인 필요 여부 체크
    if (page.url().includes("auth/login") || page.url().includes("accounts.kakao.com")) {
        console.log("세션 만료 → 로그인 진행");

        await login(page, context);

        // 🔥 S3에 업로드
        await uploadAuthToS3();
    }

    await page.pause()
    const editorPage = await openEditor(context, page);

    await switchToHtmlMode(editorPage);
    await writePost(editorPage, title, content);
    await publishWithReservation(editorPage);
    await browser.close();
}

async function login(page: Page, context: BrowserContext) {
    await page.goto("https://www.tistory.com/auth/login");

    await page.click(".link_kakao_id");
    await page.waitForURL("**accounts.kakao.com**");

    await page.fill('input[name="loginId"]', process.env.KAKAO_ID!);
    await page.fill('input[name="password"]', process.env.KAKAO_PW!);

    await page.click("button.submit");

    await page.waitForURL("**tistory.com**", {timeout: 20000});

    await page.waitForLoadState("networkidle");

// 강제로 tistory 도메인 재접근
    await page.goto("https://www.tistory.com/");
    await page.waitForLoadState("networkidle");


    const cookies = await context.cookies();
    console.log(cookies.map(c => c.name));
    await context.storageState({path: "auth.json"});

    console.log("✅ 로그인 완료");
}

async function openEditor(context: BrowserContext, page: Page): Promise<Page> {
    const [newPage] = await Promise.all([
        context.waitForEvent("page"),
        page.click('a[href*="newpost"]'),
    ]);

    await newPage.waitForLoadState("networkidle");

    newPage.on("dialog", async (dialog) => {
        await dialog.accept();
    });

    console.log("✅ 글쓰기 페이지 열림");

    return newPage;
}

async function switchToHtmlMode(page: Page) {
    await page.waitForSelector("#editor-mode-layer-btn-open", {
        state: "visible",
        timeout: 30000,
    });

    await page.click("#editor-mode-layer-btn-open");
    await page.waitForSelector("#editor-mode-html");
    await page.click("#editor-mode-html");

    await page.waitForLoadState("networkidle");

    console.log("✅ HTML 모드 전환 완료");
}

async function writePost(page: Page, title: string, content: string) {
    // 제목
    await page.fill("#post-title-inp", title);

    // 태그
    const tagString = ["playwright", "자동화", "티스토리"].join(", ");
    await page.fill("#tagText", tagString);
    await page.keyboard.press("Enter");

    // CodeMirror
    await page.waitForSelector(".cm-s-tistory-html");

    const editor = page.locator(".cm-s-tistory-html").first();

    await editor.click();
    await page.keyboard.press("Meta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(content, {delay: 5});

    console.log("✅ 글 작성 완료");
}

async function publishWithReservation(page: Page) {
    await page.click("#publish-layer-btn");

    await page.waitForSelector('button:has-text("예약")');
    await page.click('button:has-text("예약")');

    // 날짜 선택
    await page.locator(".btn_reserve").first().click();
    await page.waitForSelector(".btn_day");

    // const tomorrow = new Date();
    // tomorrow.setDate(tomorrow.getDate() + 2);
    // const day = tomorrow.getDate().toString();
    //
    // await page.locator(".btn_day", {hasText: day}).first().click();

    const {date, hour, minute} = getRandomReservationTime();
    console.log(date, hour, minute)

    console.log("예약 시간:", date);

    await page.fill("#dateHour", hour);
    await page.fill("#dateMinute", minute);

    await page.pause()

    // 발행
    await page.click("#publish-btn");

    await page.waitForURL("**/manage/posts/**", {timeout: 30000});

    console.log("✅ 예약 발행 완료");
}

function getKSTNow(): Date {
    const now = new Date();
    const kstOffset = 9 * 60;
    const localOffset = now.getTimezoneOffset();
    const offsetDiff = (kstOffset + localOffset) * 60 * 1000;
    return new Date(now.getTime() + offsetDiff);
}

function getRandomReservationTime() {
    const now = getKSTNow();

    // 1~3시간 랜덤
    const randomHours = Math.floor(Math.random() * 3) + 1;

    // 0~59분 랜덤
    const randomMinutes = Math.floor(Math.random() * 60);

    const target = new Date(now);
    target.setHours(target.getHours() + randomHours);
    target.setMinutes(randomMinutes);

    const hour = target.getHours().toString().padStart(2, "0");
    const minute = target.getMinutes().toString().padStart(2, "0");

    return {
        date: target,
        hour,
        minute,
    };
}