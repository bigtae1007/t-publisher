import {chromium, BrowserContext, Page} from "playwright";
import fs from "fs";
import {downloadAuthFromS3, uploadAuthToS3} from "./s3";

const DEBUG_DIR = "debug-artifacts";

/**
 * 🔥 메인 실행 함수
 */
export async function publishToTistory(title: string, content: string, tags: string[] = []) {
    const browser = await chromium.launch({
        headless: true, // Actions용
    });

    await downloadAuthFromS3();
    const context = fs.existsSync("auth.json")
        ? await browser.newContext({storageState: "auth.json"})
        : await browser.newContext();

    const page = await context.newPage();

    await page.goto(`${process.env.URL_T}/manage`);
    console.log("[debug] /manage 이동 후 URL:", page.url());
    await dumpDebugArtifacts(page, "01-after-manage");

    // 4️⃣ 로그인 필요 여부 체크
    if (page.url().includes("auth/login") || page.url().includes("accounts.kakao.com")) {
        console.log("세션 만료 → 로그인 진행");

        await login(page, context);
        await persistAuthToS3(context, "after-login");
    } else {
        // 기존 auth.json으로 로그인된 경우에도 최신 세션으로 갱신 저장
        await persistAuthToS3(context, "reuse-session");
    }

    const editorPage = await openEditor(page);

    await switchToHtmlMode(editorPage);
    await writePost(editorPage, title, content, tags);
    await publishWithReservation(editorPage);
    await browser.close();
}

async function login(page: Page, context: BrowserContext) {
    await page.goto("https://www.tistory.com/auth/login");
    await dumpDebugArtifacts(page, "02-login-page");

    await page.click(".link_kakao_id");
    await page.waitForURL("**accounts.kakao.com**");
    await dumpDebugArtifacts(page, "03-kakao-login-page");

    await page.fill('input[name="loginId"]', process.env.KAKAO_ID!);
    await page.fill('input[name="password"]', process.env.KAKAO_PW!);

    await page.click("button.submit");
    await dumpDebugArtifacts(page, "04-after-submit");

    await page.waitForURL("**tistory.com**", {timeout: 20000});

    await page.waitForLoadState("networkidle");
    await dumpDebugArtifacts(page, "05-after-return-tistory");

// 강제로 tistory 도메인 재접근
    await page.goto(`${process.env.URL_T}/manage`);
    await page.waitForLoadState("networkidle");
    await dumpDebugArtifacts(page, "06-after-manage-revisit");


    const cookies = await context.cookies();
    console.log(cookies.map(c => c.name));

    console.log("✅ 로그인 완료");
}

async function openEditor(page: Page): Promise<Page> {
    await page.goto(`${process.env.URL_T}/manage/post`, {
        waitUntil: "networkidle",
    });

    console.log("✅ 글쓰기 페이지 직접 이동 완료");
    console.log("[debug] editor page URL:", page.url());
    await dumpDebugArtifacts(page, "07-after-manage-post");

    return page;
}

async function switchToHtmlMode(page: Page) {
    page.once("dialog", async (dialog) => {
        console.log("dialog 발생:", dialog.message());
        await dialog.accept(); // 확인 클릭
    });

    const button = page.locator("#editor-mode-layer-btn-open");

    try {
        await dumpDebugArtifacts(page, "08-before-html-mode");
        await button.waitFor({state: "visible", timeout: 20000});
        console.log("버튼 visible 확인");

        await button.click();
        console.log("버튼 click 실행");

        await page.waitForSelector("#editor-mode-html", {timeout: 20000});
        await page.click("#editor-mode-html");

        await page.waitForLoadState("networkidle");
        await dumpDebugArtifacts(page, "09-after-html-mode");

        console.log("✅ HTML 모드 전환 완료");
    } catch (error) {
        await dumpDebugArtifacts(page, "switchToHtmlMode");
        throw error;
    }
}

async function writePost(page: Page, title: string, content: string, tags: string[] = []) {
    // 제목
    await page.fill("#post-title-inp", title);

    // 태그
    const tagString = tags.join(", ");
    await page.fill("#tagText", tagString);
    await page.keyboard.press("Enter");

    // CodeMirror
    await page.waitForSelector(".cm-s-tistory-html");

    const editor = page.locator(".cm-s-tistory-html").first();

    await editor.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
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

async function dumpDebugArtifacts(page: Page, stage: string) {
    try {
        if (!fs.existsSync(DEBUG_DIR)) {
            fs.mkdirSync(DEBUG_DIR, {recursive: true});
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const prefix = `${DEBUG_DIR}/${stage}-${timestamp}`;

        console.log(`[debug] stage=${stage}`);
        console.log("[debug] current URL:", page.url());
        console.log("[debug] page title:", await page.title());
        console.log("[debug] readyState:", await page.evaluate(() => document.readyState));
        console.log(
            "[debug] selector counts:",
            await page.locator("#editor-mode-layer-btn-open").count(),
            await page.locator("#editor-mode-html").count(),
            await page.locator("#post-title-inp").count()
        );

        await page.screenshot({path: `${prefix}.png`, fullPage: true});
        fs.writeFileSync(`${prefix}.html`, await page.content(), "utf-8");

        console.log(`[debug] screenshot: ${prefix}.png`);
        console.log(`[debug] html dump: ${prefix}.html`);
    } catch (err) {
        console.error(`[debug] artifact dump failed at ${stage}:`, err);
    }
}

async function persistAuthToS3(context: BrowserContext, reason: string) {
    await context.storageState({path: "auth.json"});
    console.log(`[debug] auth.json 저장 완료 (${reason})`);
    await uploadAuthToS3();
}
