import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { join } from "path";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;
    
    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Create Python script content
    const pythonScript = `
import sys
sys.path.append("${join(process.cwd(), "lib")}")
import canny
import json

try:
    svg1, svg2 = canny.process_image("${base64Image}")
    print(json.dumps({"sigma1": svg1, "sigma2": svg2}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;

    // Execute Python script
    const result = await new Promise((resolve, reject) => {
      const process = spawn('python', ['-c', pythonScript]);
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}\n${error}`));
        } else {
          resolve(output);
        }
      });
    });

    // Parse the result
    const data = JSON.parse(result as string);
    
    if (data.error) {
      throw new Error(data.error);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { error: "Failed to process image" },
      { status: 500 }
    );
  }
} 