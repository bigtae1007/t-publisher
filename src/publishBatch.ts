import dotenv from "dotenv";

dotenv.config();

import {publishToTistory} from "./publisher";

async function run() {
    try {
        const title = process.env.BATCH_TITLE || "테스트 제목";
        const content = process.env.BATCH_CONTENT || "<h1>Hello</h1>";

        await publishToTistory(title, content);

        console.log("배치 실행 완료");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();