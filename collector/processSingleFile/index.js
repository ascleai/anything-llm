const path = require("path");
const fs = require("fs");
const { Worker } = require('worker_threads');
const {
  WATCH_DIRECTORY,
  SUPPORTED_FILETYPE_CONVERTERS,
} = require("../utils/constants");
const {
  trashFile,
  isTextType,
  normalizePath,
  isWithin,
} = require("../utils/files");
const RESERVED_FILES = ["__HOTDIR__.md"];

// Worker 맵을 저장하는 전역 객체
const activeWorkers = new Map();

async function processSingleFile(targetFilename, options = {}, signal) {
  const fullFilePath = path.resolve(
    WATCH_DIRECTORY,
    normalizePath(targetFilename)
  );
  if (!isWithin(path.resolve(WATCH_DIRECTORY), fullFilePath))
    return {
      success: false,
      reason: "Filename is a not a valid path to process.",
      documents: [],
    };

  if (RESERVED_FILES.includes(targetFilename))
    return {
      success: false,
      reason: "Filename is a reserved filename and cannot be processed.",
      documents: [],
    };
  if (!fs.existsSync(fullFilePath))
    return {
      success: false,
      reason: "File does not exist in upload directory.",
      documents: [],
    };

  const fileExtension = path.extname(fullFilePath).toLowerCase();
  if (fullFilePath.includes(".") && !fileExtension) {
    return {
      success: false,
      reason: `No file extension found. This file cannot be processed.`,
      documents: [],
    };
  }

  let processFileAs = fileExtension;
  if (!SUPPORTED_FILETYPE_CONVERTERS.hasOwnProperty(fileExtension)) {
    if (isTextType(fullFilePath)) {
      console.log(
        `\x1b[33m[Collector]\x1b[0m The provided filetype of ${fileExtension} does not have a preset and will be processed as .txt.`
      );
      processFileAs = ".txt";
    } else {
      trashFile(fullFilePath);
      return {
        success: false,
        reason: `File extension ${fileExtension} not supported for parsing and cannot be assumed as text file type.`,
        documents: [],
      };
    }
  }

  // 이미 abort 신호가 있는 경우 즉시 종료
  if (signal?.aborted) {
    trashFile(fullFilePath);
    return {
      success: false,
      reason: "Process aborted by client",
      documents: [],
    };
  }

  // Worker 스레드를 사용하여 파일 처리
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve(__dirname, './processorWorker.js');
    
    // Worker 생성
    const worker = new Worker(workerPath, {
      workerData: {
        processorPath: SUPPORTED_FILETYPE_CONVERTERS[processFileAs],
        params: {
          fullFilePath,
          filename: targetFilename,
          options,
        }
      }
    });

    // worker ID를 파일 경로로 저장 (나중에 찾기 위함)
    activeWorkers.set(targetFilename, worker);

    // abort 이벤트 리스너 설정
    let abortListener;
    if (signal) {
      abortListener = () => {
        console.log(`Aborting worker for file: ${targetFilename}`);
        worker.terminate();
        trashFile(fullFilePath);
        resolve({
          success: false,
          reason: "Process aborted by client",
          documents: [],
        });
      };
      
      signal.addEventListener('abort', abortListener);
    }

    // Worker 메시지 처리
    worker.on('message', (result) => {
      activeWorkers.delete(targetFilename);
      if (signal && abortListener) {
        signal.removeEventListener('abort', abortListener);
      }
      resolve(result);
    });

    // 에러 처리
    worker.on('error', (err) => {
      console.error(`Worker error: ${err.message}`);
      activeWorkers.delete(targetFilename);
      if (signal && abortListener) {
        signal.removeEventListener('abort', abortListener);
      }
      trashFile(fullFilePath);
      reject(err);
    });

    // Worker 종료 처리
    worker.on('exit', (code) => {
      if (code !== 0 && !signal?.aborted) {
        console.error(`Worker stopped with exit code ${code}`);
        activeWorkers.delete(targetFilename);
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener);
        }
        trashFile(fullFilePath);
        reject(new Error(`Processing failed with exit code ${code}`));
      }
    });
  });
}


module.exports = {
  processSingleFile
};
