const fs = require('fs');
const path = require('path');

/**
 * 모든 공백을 제거하고 소문자로 변환한 문자열을 반환하는 함수
 * @param {string} text 
 * @returns {string}
 */
function removeSpacesAndLower(text) {
    return text.replace(/\s+/g, '').toLowerCase();
  }
  
  /**
   * 두 문자열을 받아, 첫 번째 문자열에 두 번째 문자열이
   * 공백 제거 및 대소문자 구분 없이 포함되어 있는지 확인
   * @param {string} text 
   * @param {string} keyword 
   * @returns {boolean}
   */
  function containsIgnoreCaseAndSpace(text, keyword) {
    const textClean = removeSpacesAndLower(text);
    const keywordClean = removeSpacesAndLower(keyword);
    return textClean.includes(keywordClean);
  }
  
  /**
   * document 문자열을 받아 titleDict와 wordsDict를 기준으로 태그를 판단하여 배열로 반환하는 함수.
   *
   * [동작 과정]
   * 1. titleDict의 각 태그에 대해, 해당하는 패턴 중 하나라도 document에 포함되면,
   *    매칭된 패턴의 첫 등장 위치(index)를 기록한다.
   *    - 여러 태그가 매칭될 경우, document에서 더 앞쪽에 등장한 태그가 배열의 앞쪽에 오도록 정렬한다.
   *
   * 2. 만약 titleDict의 어떤 패턴도 매칭되지 않으면,
   *    wordsDict에서 각 태그별로 문서에 포함된 단어 개수를 센 후, 가장 많이 매칭되는 태그 하나를 배열로 반환한다.
   *
   * @param {string} document 
   * @param {Object.<string, string[]>} titleDict - 태그별로 제목 패턴 리스트
   * @param {Object.<string, string[]>} wordsDict - title 매칭이 없을 경우 사용될 단어 패턴 리스트
   * @returns {string[]} 매칭된 태그들의 배열 (매칭이 없으면 빈 배열)
   */
  function determineTags(document) {
    const titleDict = {
        "title": ["의무기록 사본", "의무기록 사본 증명서", "의무기록사본발급증명서", "의무기록 사본발행 증명서", "진료기록사본", "표지제외"],
        "bills": ["진료비 내역서", "납입확인서", "소득공제", "진료비 계산서", "정액수가", "포괄수가", "납부한 금액", "진료비 영수증", "현금영수증", "급여"],
        "bills_detail": ["입원처방 상세내역", "세부산정내역", "세부내역서", "급여"],
        "confirmation": ["진료 확인서", "통원 확인서", "통원 중임", "통원)확인서", "퇴원 확인서", "입원 확인서", "외출 신청서", "외박 신청서", "진료 받았음을 확인합니다"],
        "medical_record": ["진료기록부", "응급진료기록", "진료기록지", "KTAS", "Triage Note", "재진기록", "초진기록", "경과기록", "Progress note", "Doctor's Record", "외래처방전", "Clinical Chart", "Patient's Chart", "요약기록"],
        "doctor_order": ["Doctor Order", "Doctor's Order", "ORDER SHEET", "의사지시기록", "오더일"],
        "exam_report": ["검사슬립지", "판독일", "판독시간", "Exam date", "판독의", "판독자", "촬영일자", "검사일", "판독결과", "검체채취", "채취일", "검체접수", "검사시행일", "Test Result", "조직병리", "참고치", "기능결과", "기능검사", "Report for", "Reported by", "Examination Date", "영상의학 보고서", "Examining"],
        "operation_record": ["물리치료 기록지", "Treatment Record", "Operation Record", "수술기록", "Date of Operation", "Name of operation", "surgeon", "anesthesi", "anesth method", "circulator", "마취종류", "수술시작시간", "수술종료시간", "집도의", "수술소견"],
        "medical_certificate": ["제5호의", "17조", "9조 1항", "9조 제1항", "같이 진단합니다"],
        "nurse_record": ["Nurse Record", "Nursing record", "NURSE NOTE", "간호일지", "간호기록"],
        "impression_report": ["진료 소견서", "소견서"],
        "hospitalization_record": ["입원기록", "퇴원기록", "퇴실기록", "입원요약", "퇴원요약", "Discharge Summary", "간호정보 조사", "환자간호력", "의식상태", "수혈력", "간호 및 교육"],
      };
      
      const wordsDict = {
        "title": ["발행된 사본", "상기 용도 외", "제출용"],
        "bills": ["본인부담", "할인액", "공단부담", "검사료", "총액", "금액"],
        "bills_detail": ["본인부담", "공단부담", "입원처방 상세내역", "세부산정내역", "세부내역서", "검사료", "총액", "금액"],
        "confirmation": ["원무과", "확인합니다", "FAX"],
        "medical_record": ["초진", "재진", "주상병", "보조상병", "Subjecive", "Chart", "Note", "진료기록"],
        "doctor_order": ["Order", "오더의", "오더시간", "처방자"],
        "exam_report": ["검사명", "영상검사", "진단검사", "검사결과", "report", "result", "Findings", "검사항목", "study"],
        "operation_record": ["Assistant", "ass't", "drain", "Preoprative", "postoperative", "operation"],
        "medical_certificate": ["표준질병", "한국표준", "최종진단", "진단서"],
        "nurse_record": ["간호사", "Nurs"],
        "impression_report": ["내원경위"],
        "hospitalization_record": ["배설기능", "삼킴장애", "수면장애", "교육수준", "수술병력", "입원동기", "현병력", "현재력", "흡연", "음주", "입원상태", "discharge", "hospitaliz"],
      };

    // 문서 내 검색을 위해 공백 제거 및 소문자 처리
    const docClean = removeSpacesAndLower(document);
  
    // 1. titleDict를 이용한 매칭 검사
    const titleMatches = []; // { tag, index } 객체들을 저장
  
    for (const tag in titleDict) {
      const patterns = titleDict[tag];
      let earliestIndex = docClean.length + 1;
      let found = false;
      for (const pattern of patterns) {
        const patternClean = removeSpacesAndLower(pattern);
        const index = docClean.indexOf(patternClean);
        if (index !== -1) {
          found = true;
          if (index < earliestIndex) {
            earliestIndex = index;
          }
        }
      }
      if (found) {
        titleMatches.push({ tag, index: earliestIndex });
      }
    }
  
    if (titleMatches.length > 0) {
      // 문서 내 등장 위치 기준으로 정렬 (앞쪽일수록 낮은 index)
      titleMatches.sort((a, b) => a.index - b.index);
      // 정렬된 태그 목록을 반환
      const titleTag = titleMatches.map(match => match.tag);
      console.log(`✅ determineTags from title: ${titleTag}`);
      return titleTag;
    }
  
    // 2. title 매칭이 없을 경우 wordsDict 사용
    let bestTag = null;
    let maxCount = 0;
    for (const tag in wordsDict) {
      const words = wordsDict[tag];
      let count = 0;
      for (const word of words) {
        if (containsIgnoreCaseAndSpace(document, word)) {
          count++;
        }
      }
      if (count > maxCount) {
        maxCount = count;
        bestTag = tag;
      }
    }
    console.log(`✅ determineTags from word: ${bestTag}`);
    return bestTag !== null ? [bestTag] : [];
  }
  
if (require.main === module) {
    // 예제 사용법 (테스트 코드)
    const documentStr = "This is a sample Document. It contains a Title Example and other words.";
    const tags = determineTags(documentStr);
    console.log("Determined tags:", tags);

    /**
     * 파일명에서 첫번째 숫자를 추출하여 정수로 반환하는 함수.
     * 숫자가 없으면 0을 반환.
     * @param {string} filename 
     * @returns {number}
     */
    function extractNumber(filename) {
    const match = filename.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
    }

    // 파일이 저장된 디렉토리 (예: "ocr/" 폴더)
    const directory = "../../../../../../playground/ocr/";
    // contexts 배열 초기화 (파일 내용들을 저장)
    const contexts = [];

    // 디렉토리 내 파일들을 정렬된 순서로 읽어오기
    const filenames = fs.readdirSync(directory).filter(file => file.endsWith(".txt"));
    filenames.sort((a, b) => extractNumber(a) - extractNumber(b));

    for (const filename of filenames) {
    const filePath = path.join(directory, filename);
    const content = fs.readFileSync(filePath, "utf8");
    contexts.push(content);
    }

    // 각 문서에 대해 태그를 결정한 후 출력
    contexts.forEach((doc, index) => {
    const tags = determineTags(doc);
    console.log(index + 1, tags, JSON.stringify(doc.slice(0, 80)));
    });
}

module.exports = { determineTags };