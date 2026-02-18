import dotenv from "dotenv";

dotenv.config();

import {publishToTistory} from "./publisher";

interface NextBlogResponse {
    success: boolean;
    data : {
        id: number;
        title : string;
        content : string;
        tags : string[];
        category?: number | string | null;
    } | null;
    error: unknown;
}

interface DoneResponse {
    success: boolean;
    error: unknown;
}

function getServerBaseUrl(): string {
    const serverUrl = process.env.SERVER_URI;

    if (!serverUrl) {
        throw new Error("SERVER_URI is not set");
    }

    return serverUrl.endsWith("/") ? serverUrl.slice(0, -1) : serverUrl;
}

async function fetchNextBlog(baseUrl: string): Promise<NonNullable<NextBlogResponse["data"]>> {
    const response = await fetch(`${baseUrl}/blogs/unzipped/next`);

    if (!response.ok) {
        throw new Error(`Failed to fetch next blog: ${response.status} ${response.statusText}`);
    }

    const payload: NextBlogResponse = await response.json();

    if (!payload.success || !payload.data) {
        throw new Error(`Next blog API returned failure: ${JSON.stringify(payload.error)}`);
    }

    return payload.data;
}

async function markBlogDone(baseUrl: string, id: number): Promise<void> {
    const response = await fetch(`${baseUrl}/blogs/files/${id}/done`, {
        method: "PATCH",
    });

    if (!response.ok) {
        throw new Error(`Failed to mark blog as done: ${response.status} ${response.statusText}`);
    }

    const payload: DoneResponse = await response.json();

    if (!payload.success) {
        throw new Error(`Done API returned failure: ${JSON.stringify(payload.error)}`);
    }
}

async function run() {
    try {
        const baseUrl = getServerBaseUrl();
        console.log("블로그 조회 중")
        const nextBlog = await fetchNextBlog(baseUrl);

        console.log(`${nextBlog.title} 업로드 시작`)
        await publishToTistory(nextBlog.title, nextBlog.content, nextBlog.tags, nextBlog.category);
        console.log(`${nextBlog.title} 업로드 완료 처리 중 ~`)
        await markBlogDone(baseUrl, nextBlog.id);

        console.log("배치 실행 완료");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
