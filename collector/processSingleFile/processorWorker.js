const { workerData, parentPort } = require('worker_threads');
const path = require('path');

async function runProcessor() {
  try {
    const { processorPath, params } = workerData;
    // 프로세서 모듈 로드
    const processor = require(path.join(__dirname, processorPath.replace('./', '/')));
    
    // 프로세서 실행
    const result = await processor(params);
    
    // 결과를 메인 스레드로 전송
    parentPort.postMessage(result);
  } catch (error) {
    // 오류 발생 시 실패 응답 전송
    parentPort.postMessage({
      success: false,
      reason: error.message,
      documents: [],
    });
  }
}

// 프로세서 실행
runProcessor(); 