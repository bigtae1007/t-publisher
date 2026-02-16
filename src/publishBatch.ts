import dotenv from "dotenv";

dotenv.config();

import {publishToTistory} from "./publisher";

interface Response {
    data : {
        title : string;
        content : string
        tags : string[]
    }
}
async function run() {
    try {
        const response = await fetch(process.env.SERVER_URI!);
        const data : Response = await response.json()
        await publishToTistory(data.data.title, data.data.content,data.data.tags);

        console.log("배치 실행 완료");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();