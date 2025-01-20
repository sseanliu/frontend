import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import { join } from "path";

// New way to configure the API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Remove the old config export and use route segment config
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const bodySize = '10mb';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Check file size (10MB limit)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    // Convert image to base64
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');

    // Free up memory
    buffer.fill(0);

    // Create Python script content
    const pythonScript = `
import sys
sys.path.append("${join(process.cwd(), "lib")}")
import canny
import json
import gc

try:
    svg1, svg2 = canny.process_image("${base64Image}")
    print(json.dumps({"sigma1": svg1, "sigma2": svg2}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
finally:
    gc.collect()  # Force garbage collection
`;

    // Execute Python script with reduced buffer size
    const result = await new Promise((resolve, reject) => {
      let pythonProcess: ChildProcess | null = null;
      
      const timeoutId = setTimeout(() => {
        if (pythonProcess) {
          pythonProcess.kill();
        }
        reject(new Error('Processing timeout'));
      }, 25000); // 25 seconds timeout

      const pythonPath = process.env.PYTHON_PATH || 'python';
      pythonProcess = spawn(pythonPath, ['-c', pythonScript], {
        env: { ...process.env, PYTHONPATH: join(process.cwd(), "lib") }
      });
      
      let output = '';
      let error = '';

      pythonProcess.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      pythonProcess.stderr?.on('data', (data: Buffer) => {
        error += data.toString();
      });

      pythonProcess.on('close', (code: number) => {
        clearTimeout(timeoutId);
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