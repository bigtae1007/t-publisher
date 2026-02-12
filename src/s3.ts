import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import fs from "fs";

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const bucket = process.env.S3_BUCKET_NAME!;
const key = process.env.S3_AUTH_KEY!;

// 🔹 S3에서 auth.json 다운로드
export async function downloadAuthFromS3() {
    try {
        const command = new GetObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        const response = await s3.send(command);

        if (!response.Body) return false;

        const stream = response.Body as Readable;
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
        }

        const data = Buffer.concat(chunks);
        fs.writeFileSync("auth.json", data);

        console.log("S3 → auth.json 다운로드 완료");
        return true;
    } catch (e) {
        console.log("S3에 auth.json 없음");
        return false;
    }
}

// 🔹 auth.json 업로드
export async function uploadAuthToS3() {
    const file = fs.readFileSync("auth.json");

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: "application/json",
    });

    await s3.send(command);
    console.log("auth.json S3 업로드 완료");
}