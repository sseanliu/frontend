import { NextRequest, NextResponse } from "next/server";
import { spawn, type ChildProcess } from "child_process";
import { join } from "path";

// Route segment configuration
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Configure response caching
export const fetchCache = 'force-no-store';
export const revalidate = 0;

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
import os
print("Current working directory:", os.getcwd())
print("Python path:", sys.path)

lib_path = os.path.join(os.getcwd(), "lib")
print("Adding lib path:", lib_path)
sys.path.append(lib_path)

try:
    import canny
    print("Successfully imported canny module")
except Exception as e:
    print("Error importing canny module:", str(e))
    sys.exit(1)

import json
import gc

try:
    print("Processing image...")
    svg1, svg2 = canny.process_image("${base64Image}")
    print("Image processing complete")
    print(json.dumps({"sigma1": svg1, "sigma2": svg2}))
except Exception as e:
    print("Error during processing:", str(e))
    print(json.dumps({"error": str(e)}))
finally:
    gc.collect()  # Force garbage collection
`;

    console.log('Executing Python script...');
    
    // Execute Python script with reduced buffer size
    const result = await new Promise((resolve, reject) => {
      let pythonProcess: ChildProcess | null = null;
      
      const timeoutId = setTimeout(() => {
        if (pythonProcess) {
          pythonProcess.kill();
        }
        reject(new Error('Processing timeout'));
      }, 25000); // 25 seconds timeout

      const pythonPath = process.env.PYTHON_PATH || 'python3';
      console.log('Using Python path:', pythonPath);
      
      pythonProcess = spawn(pythonPath, ['-c', pythonScript], {
        env: { 
          ...process.env, 
          PYTHONPATH: join(process.cwd(), "lib"),
          PYTHONUNBUFFERED: "1"
        }
      });
      
      let output = '';
      let error = '';

      pythonProcess.stdout?.on('data', (data: Buffer) => {
        const str = data.toString();
        console.log('Python stdout:', str);
        output += str;
      });

      pythonProcess.stderr?.on('data', (data: Buffer) => {
        const str = data.toString();
        console.error('Python stderr:', str);
        error += str;
      });

      pythonProcess.on('close', (code: number) => {
        clearTimeout(timeoutId);
        console.log('Python process exited with code:', code);
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}\nError: ${error}\nOutput: ${output}`));
        } else {
          resolve(output);
        }
      });
    });

    // Parse the result
    console.log('Raw Python output:', result);
    const data = JSON.parse(result as string);
    
    if (data.error) {
      console.error('Python script reported error:', data.error);
      throw new Error(data.error);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error processing image:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process image" },
      { status: 500 }
    );
  }
} 