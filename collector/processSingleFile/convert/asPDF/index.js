const { v4 } = require("uuid");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../../utils/files");
const { tokenizeString } = require("../../../utils/tokenizer");
const { default: slugify } = require("slugify");
const PDFLoader = require("./PDFLoader");
const OCRLoader = require("../../../utils/OCRLoader");
const { determineTags } = require("./PDFLoader/determineTags");

async function asPdf({ fullFilePath = "", filename = "", options = {} }) {
  const pdfLoader = new PDFLoader(fullFilePath, {
    splitPages: true,
  });

  console.log(`-- Working ${filename} --`);
  
  // PDFLoader를 사용하여 페이지별 텍스트 추출
  let docs = await pdfLoader.load();

  // 텍스트가 없는 경우, OCRLoader를 사용하여 텍스트 추출
  if (docs.length === 0) {
    console.log(`[asPDF] No text content found for ${filename}. Will attempt OCR parse.`);
    docs = await new OCRLoader({
      targetLanguages: options?.ocr?.langList,
    }).ocrPDF(fullFilePath);
  }

  // 각 페이지 문서 중 텍스트가 있는 것만 사용
  const validDocs = docs.filter(doc => doc.pageContent && doc.pageContent.length);
  if (validDocs.length === 0) {
    console.error(`[asPDF] Resulting text content was empty for ${filename}.`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }

  // 메인 문서 생성: 전체 페이지 텍스트를 결합하여 하나의 문서로 저장
  const fullContent = validDocs.map(doc => doc.pageContent).join("");
  const mainData = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: filename,
    docAuthor: validDocs[0]?.metadata?.pdf?.info?.Creator || "no author found",
    description: validDocs[0]?.metadata?.pdf?.info?.Title || "No description found.",
    docSource: "pdf file uploaded by the user.",
    chunkSource: "",
    published: createdDate(fullFilePath),
    wordCount: fullContent.split(" ").length,
    pageContent: fullContent,
    token_count_estimate: tokenizeString(fullContent),
    tag: "full",
  };

  const mainDocument = writeToServerDocuments(
    mainData,
    `${slugify(filename, {
      remove: /[^\w\s$*_+~.()'"!\-:@\uAC00-\uD7A3]+/g,
    })}-${mainData.id}`
  );

  // 태그별로 페이지들을 그룹화하여 별도의 문서 생성
  const tagGroups = {};
  let previousTag = null; // 이전 태그를 저장할 변수

  [...validDocs.entries()].forEach(([index, doc]) => {
    // 현재 처리 중인 문서 번호 출력
    console.log(`Tag 확인 중: ${index + 1}/${validDocs.length}`);
    
    // 각 페이지 텍스트로부터 태그 리스트 생성
    const tags = determineTags(doc.pageContent);
    let tag = tags[0];
    
    // tags가 비어있으면 이전 태그를 사용
    if (!tag && previousTag) {
      tag = previousTag;
    }
    
    if (tag) {
      if (!tagGroups[tag]) {
        tagGroups[tag] = [];
      }
      tagGroups[tag].push(doc.pageContent);
      previousTag = tag; // 현재 태그를 이전 태그로 저장
    }
  });

  const tagDocuments = [];
  for (const tag in tagGroups) {
    // 해당 태그에 해당하는 페이지 텍스트 결합
    const tagContent = tagGroups[tag].join("\n\n");
    const tagData = {
      id: v4(),
      url: "file://" + fullFilePath,
      title: `${filename} - ${tag}`,
      docAuthor: validDocs[0]?.metadata?.pdf?.info?.Creator || "no author found",
      description: validDocs[0]?.metadata?.pdf?.info?.Title || "No description found.",
      docSource: "pdf file uploaded by the user.",
      chunkSource: "",
      published: createdDate(fullFilePath),
      wordCount: tagContent.split(" ").length,
      pageContent: tagContent,
      token_count_estimate: tokenizeString(tagContent),
      tag,  // 태그 정보를 추가할 수도 있음
    };

    const tagDocument = writeToServerDocuments(
      tagData,
      `${slugify(`${filename}-${tag}`, {
        remove: /[^\w\s$*_+~.()'"!\-:@\uAC00-\uD7A3]+/g,
      })}-${tagData.id}`
    );
    tagDocuments.push(tagDocument);
  }

  trashFile(fullFilePath);
  console.log(`[SUCCESS]: ${filename} converted & ready for embedding.\n`);
  return { success: true, reason: null, documents: [mainDocument, ...tagDocuments] };
}

module.exports = asPdf;