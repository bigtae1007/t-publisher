import dotenv from "dotenv";

dotenv.config();

import {publishToTistory, ReservationTime} from "./publisher";

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

async function fetchNextBlog(baseUrl: string): Promise<NextBlogResponse["data"]> {
    const response = await fetch(`${baseUrl}/blogs/unzipped/next`);

    if (!response.ok) {
        throw new Error(`Failed to fetch next blog: ${response.status} ${response.statusText}`);
    }

    const payload: NextBlogResponse = await response.json();

    if (!payload.success) {
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

function parsePublishCount(): number {
    const raw = process.env.PUBLISH_COUNT ?? "2";
    const parsed = Number.parseInt(raw, 10);

    if (Number.isNaN(parsed) || parsed < 1) {
        return 2;
    }

    return parsed;
}

function parseReservationOffsets(count: number): number[] {
    const raw = process.env.RESERVE_OFFSETS_MINUTES ?? "35,119";
    const parsed = raw
        .split(",")
        .map(v => Number.parseInt(v.trim(), 10))
        .filter(v => !Number.isNaN(v) && v >= 0);

    if (parsed.length === 0) {
        return [35, 119].slice(0, count);
    }

    if (parsed.length >= count) {
        return parsed.slice(0, count);
    }

    const result = [...parsed];
    while (result.length < count) {
        result.push(result[result.length - 1] + 90);
    }

    return result;
}

function getHourStartInKST(): Date {
    const now = new Date();
    const hourStart = new Date(now);
    hourStart.setMinutes(0, 0, 0);
    return hourStart;
}

function buildReservationTime(offsetMinutes: number): ReservationTime {
    const base = getHourStartInKST();
    const target = new Date(base.getTime() + offsetMinutes * 60 * 1000);

    return {
        hour: target.getHours().toString().padStart(2, "0"),
        minute: target.getMinutes().toString().padStart(2, "0"),
    };
}

async function run() {
    try {
        const baseUrl = getServerBaseUrl();
        const publishCount = parsePublishCount();
        const offsets = parseReservationOffsets(publishCount);
        console.log(`[batch] 실행 건수: ${publishCount}, 예약 오프셋(분): ${offsets.join(", ")}`);

        for (let i = 0; i < publishCount; i += 1) {
            console.log(`[batch] ${i + 1}/${publishCount} 블로그 조회 중`);
            const nextBlog = await fetchNextBlog(baseUrl);

            if (!nextBlog) {
                console.log(`[batch] 처리할 글이 없어 ${i + 1}번째에서 종료`);
                break;
            }

            const reservationTime = buildReservationTime(offsets[i]);
            console.log(
                `[batch] ${i + 1}/${publishCount} 예약 시간: ${reservationTime.hour}:${reservationTime.minute}`
            );
            console.log(`${nextBlog.title} 업로드 시작`);
            await publishToTistory(
                nextBlog.title,
                nextBlog.content,
                nextBlog.tags,
                nextBlog.category,
                reservationTime
            );
            console.log(`${nextBlog.title} 업로드 완료 처리 중 ~`);
            await markBlogDone(baseUrl, nextBlog.id);
        }

        console.log("배치 실행 완료");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
