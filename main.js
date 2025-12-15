// 로컬 개발 환경 여부 (내 PC에서 띄운 경우)
const isLocalDev =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.protocol === "file:";

// ===== 상태 & File System Access =====

let state = {
  categories: [],
  posts: [], // { id, title, categoryId, contentHtml, createdAt }
  currentCategoryId: "all",
  editingPostId: null,
};
// 이미지 저장용
let imagesDirHandle = null;

// 파일 저장용
let fileHandle = null;

// ===== 정적 글 페이지 생성용 (posts 폴더 / sitemap / index 템플릿) =====
let postsDirHandle = null;        // /posts 폴더 핸들
let sitemapFileHandle = null;     // sitemap.xml 파일 핸들
let indexTemplateFileHandle = null; // index.html 파일 핸들(템플릿)

// ===== DOM 참조 =====

// 파일 연결 관련
const connectFileBtn = document.getElementById("connectFileBtn");
const fileStatusText = document.getElementById("fileStatusText");

// 사이드바 / 카테고리 관련
const addCategoryBtn = document.getElementById("addCategoryBtn");
const categoryListEl = document.getElementById("categoryList");
const categoryFormEl = document.getElementById("categoryForm");
const categoryNameInput = document.getElementById("categoryNameInput");
const categorySaveBtn = document.getElementById("categorySaveBtn");
const categoryCancelBtn = document.getElementById("categoryCancelBtn");

// 메인 / 상단
const newPostBtn = document.getElementById("newPostBtn");
const postListView = document.getElementById("postListView");
const postEditorView = document.getElementById("postEditorView");
const postDetailView = document.getElementById("postDetailView");

const postListEl = document.getElementById("postList");
const postListTitleEl = document.getElementById("postListTitle");
const emptyPostMessageEl = document.getElementById("emptyPostMessage");

// 글 작성/편집 폼
const editorTitleEl = document.getElementById("editorTitle");
const postTitleInput = document.getElementById("postTitleInput");
const postCategorySelect = document.getElementById("postCategorySelect");
const postContentEditor = document.getElementById("postContentEditor");
const editorToolbarEl = document.getElementById("editorToolbar");
const toolbarFontSize = document.getElementById("toolbarFontSize");
const toolbarColorPalette = document.getElementById("toolbarColorPalette");
const postSaveBtn = document.getElementById("postSaveBtn");
const postCancelBtn = document.getElementById("postCancelBtn");

// 글 상세
const backToListBtn = document.getElementById("backToListBtn");
const detailTitleEl = document.getElementById("detailTitle");
const detailCategoryEl = document.getElementById("detailCategory");
const detailDateEl = document.getElementById("detailDate");
const detailContentEl = document.getElementById("detailContent");
const detailEditBtn = document.getElementById("detailEditBtn");
const detailDeleteBtn = document.getElementById("detailDeleteBtn");

// 댓글(giscus) 컨테이너
const giscusContainerEl = document.getElementById("giscusContainer");

// 카테고리 편집용 임시 변수
let editingCategoryId = null;

// ===== 유틸 =====

function generateId(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}

function stripHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

// ===== posts.json 초기 로드 (fetch) =====

async function loadInitialState() {
  // 정적 글 페이지(posts/*.html)에서 주입된 데이터가 있으면 fetch 없이 바로 사용
  if (window.__STATIC_PREFETCH__) {
    const data = window.__STATIC_PREFETCH__;
    state.categories = data.categories || [];
    state.posts = data.posts || [];
    state.currentCategoryId = "all";
    return;
  }

  try {
    const res = await fetch("posts.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    state.categories = data.categories || [];
    state.posts = data.posts || [];
    state.currentCategoryId = "all";
  } catch (e) {
    console.warn("posts.json 로드 실패, 기본 상태로 시작:", e);
    // 기본값
    state.categories = [];
    state.posts = [];
  }
}

// ===== File System Access: 파일 선택 / 읽기 / 쓰기 =====

async function pickFile() {
  if (!window.showOpenFilePicker) {
    alert("이 기능은 Chrome / Edge 같은 Chromium 브라우저에서만 동작합니다.");
    return null;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: "JSON Files",
          accept: { "application/json": [".json"] },
        },
      ],
      excludeAcceptAllOption: true,
      multiple: false,
    });
    fileHandle = handle;
    fileStatusText.textContent = `로컬 파일: ${handle.name} 연결됨`;
    return handle;
  } catch (e) {
    console.warn("파일 선택 취소 또는 오류:", e);
    return null;
  }
}

async function ensureFileHandle() {
  if (fileHandle) return fileHandle;
  const handle = await pickFile();
  return handle;
}

async function loadFromConnectedFile() {
  const handle = await pickFile();
  if (!handle) return;

  try {
    const file = await handle.getFile();
    const text = await file.text();
    const data = JSON.parse(text);

    state.categories = data.categories || [];
    state.posts = data.posts || [];
    state.currentCategoryId = "all";
    state.editingPostId = null;

    renderCategories();
    renderPostList();
    showView("list");
  } catch (e) {
    console.error("연결된 파일에서 로드 실패:", e);
    alert("파일을 읽는 중 오류가 발생했습니다. JSON 형식을 확인해 주세요.");
  }
}

async function saveJsonToFile() {
  const handle = await ensureFileHandle();
  if (!handle) {
    alert("posts.json 파일을 먼저 선택해야 합니다.");
    return;
  }

  try {
    const writable = await handle.createWritable();
    const data = JSON.stringify(
      {
        categories: state.categories,
        posts: state.posts,
      },
      null,
      2
    );
    await writable.write(data);
    await writable.close();
    fileStatusText.textContent = `로컬 파일: ${handle.name} 저장 완료`;
  } catch (e) {
    console.error("파일 저장 실패:", e);
    alert("파일 저장 중 오류가 발생했습니다.");
  }
}

// ===== 카테고리 =====

function getCategoryName(categoryId) {
  const cat = state.categories.find((c) => c.id === categoryId);
  return cat ? cat.name : "알 수 없음";
}

function renderCategories() {
  const categoryListEl = document.getElementById("categoryList");
  if (!categoryListEl) {
    console.error("카테고리 리스트 요소(#categoryList)를 찾지 못했습니다.");
    return;
  }

  categoryListEl.innerHTML = "";

  // 항상 "전체"는 추가
  const allItem = document.createElement("li");
  allItem.className =
    "category-item" + (state.currentCategoryId === "all" ? " active" : "");
  allItem.innerHTML = `<span class="category-name">전체</span>`;
  allItem.addEventListener("click", () => {
    location.hash = "#category/all";
  });
  categoryListEl.appendChild(allItem);

  if (!Array.isArray(state.categories)) {
    console.warn("state.categories가 배열이 아닙니다:", state.categories);
    return;
  }

  // posts.json의 categories를 렌더링
  state.categories.forEach((cat) => {
    const li = document.createElement("li");
    const isActive = state.currentCategoryId === cat.id;

    li.className = "category-item" + (isActive ? " active" : "");
    li.innerHTML = `
      <span class="category-name">${cat.name}</span>
      <div class="category-actions editor-only">
        <button class="icon-btn" data-action="edit">✎</button>
        <button class="icon-btn" data-action="delete">🗑</button>
      </div>
    `;

    // 카테고리 선택
    li.addEventListener("click", (e) => {
      if (e.target.matches("button")) return; // 편집/삭제 버튼 클릭은 패스
      location.hash = `#category/${cat.id}`;
    });

    // 편집 버튼
    const editBtn = li.querySelector('[data-action="edit"]');
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openCategoryForm(cat);
    });

    // 삭제 버튼
    const delBtn = li.querySelector('[data-action="delete"]');
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteCategory(cat.id);
    });

    categoryListEl.appendChild(li);
  });
}

function openCategoryForm(category) {
  categoryFormEl.classList.remove("hidden");
  if (category) {
    editingCategoryId = category.id;
    categoryNameInput.value = category.name;
  } else {
    editingCategoryId = null;
    categoryNameInput.value = "";
  }
  categoryNameInput.focus();
}

function closeCategoryForm() {
  editingCategoryId = null;
  categoryFormEl.classList.add("hidden");
  categoryNameInput.value = "";
}

async function saveCategory() {
  const name = categoryNameInput.value.trim();
  if (!name) {
    alert("카테고리 이름을 입력해주세요.");
    return;
  }

  if (editingCategoryId) {
    const cat = state.categories.find((c) => c.id === editingCategoryId);
    if (cat) cat.name = name;
  } else {
    state.categories.push({ id: generateId("cat"), name });
  }

  renderCategories();
  closeCategoryForm();
  await saveJsonToFile();
}

async function deleteCategory(categoryId) {
  const hasPosts = state.posts.some((p) => p.categoryId === categoryId);
  if (hasPosts) {
    const ok = confirm(
      "이 카테고리에 속한 글도 모두 삭제됩니다. 계속할까요?"
    );
    if (!ok) return;

    state.posts = state.posts.filter((p) => p.categoryId !== categoryId);
  }

  state.categories = state.categories.filter((c) => c.id !== categoryId);

  if (state.currentCategoryId === categoryId) {
    state.currentCategoryId = "all";
  }

  renderCategories();
  renderPostList();
  await saveJsonToFile();
}

// ===== 글 리스트 & 상세 =====
function renderPostList() {
  postListEl.innerHTML = "";

  const posts =
    state.currentCategoryId === "all"
      ? state.posts
      : state.posts.filter((p) => p.categoryId === state.currentCategoryId);

  postListTitleEl.textContent =
    state.currentCategoryId === "all"
      ? "전체 글"
      : `${getCategoryName(state.currentCategoryId)} 글`;

  if (posts.length === 0) {
    emptyPostMessageEl.classList.remove("hidden");
    return;
  } else {
    emptyPostMessageEl.classList.add("hidden");
  }

  const sorted = [...posts].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  sorted.forEach((post) => {
    const card = document.createElement("article");
    card.className = "post-card";

    const categoryName = getCategoryName(post.categoryId);
    const dateStr = formatDate(post.createdAt);
    const text = stripHtml(post.contentHtml || "");
    const excerpt = text.length > 80 ? text.slice(0, 80) + "." : text;

    // 여기서만 post를 사용해야 함 (forEach 밖에서 쓰면 바로 ReferenceError)
    const staticUrl = `posts/${post.id}.html`;

    card.innerHTML = `
      <h3 class="post-title">
        <a class="post-title-link" href="${staticUrl}">${post.title}</a>
      </h3>
      <div class="post-meta-line">
        <span class="category-pill">${categoryName}</span>
        <span>${dateStr}</span>
      </div>
      <p class="post-excerpt">${excerpt}</p>
    `;

    // 링크 클릭 시엔 정적 페이지로 이동 (크롤링/검색 유입용)
    const linkEl = card.querySelector(".post-title-link");
    linkEl.addEventListener("click", (e) => {
      // 카드 클릭(해시 이동)과 충돌 방지
      e.stopPropagation();
    });

    // 카드 클릭 시엔 기존 SPA 방식 유지
    card.addEventListener("click", () => {
      location.hash = `#post/${post.id}`;
    });

    postListEl.appendChild(card);
  });
}

function openPostDetail(postId) {
  const post = state.posts.find((p) => p.id === postId);
  if (!post) return;

  state.editingPostId = postId;

  detailTitleEl.textContent = post.title;
  detailCategoryEl.textContent = getCategoryName(post.categoryId);
  detailDateEl.textContent = formatDate(post.createdAt);
  detailContentEl.innerHTML = post.contentHtml || "";

  showView("detail");
  loadGiscusForPost(post);
}

// ===== giscus 로딩 =====

function loadGiscusForPost(post) {
  giscusContainerEl.innerHTML = "";

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.async = true;
  script.crossOrigin = "anonymous";

  // giscus.app 설정
  script.setAttribute("data-repo", "woong020477/DevoongLog");
  script.setAttribute("data-repo-id", "R_kgDOQUsjEg");
  script.setAttribute("data-category", "General");
  script.setAttribute("data-category-id", "DIC_kwDOQUsjEs4Cx4Ih");

  script.setAttribute("data-mapping", "specific");
  script.setAttribute("data-term", `post-${post.id}`);
  script.setAttribute("data-strict", "1");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "bottom");
  script.setAttribute("data-theme", "dark_dimmed");
  script.setAttribute("data-lang", "ko");

  giscusContainerEl.appendChild(script);
}

// ===== 글 작성/편집 =====

function fillCategorySelect() {
  postCategorySelect.innerHTML = "";
  state.categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat.id;
    opt.textContent = cat.name;
    postCategorySelect.appendChild(opt);
  });
}

function openEditorForNewPost() {
  state.editingPostId = null;
  editorTitleEl.textContent = "새 글 작성";

  postTitleInput.value = "";
  postContentEditor.innerHTML = "";

  fillCategorySelect();

  if (state.currentCategoryId !== "all") {
    postCategorySelect.value = state.currentCategoryId;
  }

  showView("editor");
  postTitleInput.focus();
}

function openEditorForEdit() {
  if (!state.editingPostId) return;
  const post = state.posts.find((p) => p.id === state.editingPostId);
  if (!post) return;

  editorTitleEl.textContent = "글 수정";
  postTitleInput.value = post.title;

  fillCategorySelect();
  postCategorySelect.value = post.categoryId;

  postContentEditor.innerHTML = post.contentHtml || "";

  showView("editor");
}

async function savePost() {
  const title = postTitleInput.value.trim();
  const categoryId = postCategorySelect.value;
  const contentHtml = (postContentEditor.innerHTML || "").trim();

  if (!title || !categoryId || !contentHtml) {
    alert("제목, 카테고리, 내용을 모두 입력해주세요.");
    return;
  }

  if (state.editingPostId) {
    const post = state.posts.find((p) => p.id === state.editingPostId);
    if (post) {
      post.title = title;
      post.categoryId = categoryId;
      post.contentHtml = contentHtml;
    }
  } else {
    const newPost = {
      id: generateId("post"),
      title,
      categoryId,
      contentHtml,
      createdAt: new Date().toISOString(),
    };
    state.posts.push(newPost);
    state.editingPostId = newPost.id;
  }

  await saveJsonToFile();
  // 로컬에서만: 정적 글 파일 + sitemap 자동 갱신
  if (isLocalDev) {
    await generateStaticPagesAndSitemap();
  }

  renderPostList();

  // 방금 저장한 글 상세로 이동 (라우터가 처리)
  location.hash = `#post/${state.editingPostId}`;
}

async function generateStaticPagesAndSitemap() {
  // 브라우저/환경 체크
  if (!window.showDirectoryPicker || !window.showOpenFilePicker) return;

  const dir = await ensurePostsDirHandle();
  if (!dir) return;

  // 글 파일 생성/갱신
  for (const post of state.posts) {
    const html = await buildPostHtmlFromIndexTemplate(post);
    if (!html) continue;

    const fileName = getPostHtmlFileName(post);
    const postFileHandle = await dir.getFileHandle(fileName, { create: true });
    await writeTextFile(postFileHandle, html);
  }

  // sitemap.xml 갱신
  const sitemapHandle = await ensureSitemapFileHandle();
  if (sitemapHandle) {
    const xml = buildSitemapXml();
    await writeTextFile(sitemapHandle, xml);
  }

  // (선택) 상태 표시
  fileStatusText.textContent = `정적 글/사이트맵 생성 완료 (${state.posts.length}개)`;
}

// posts 폴더에서 특정 글 html 삭제
async function deleteStaticPostFile(postId) {
  const dir = await ensurePostsDirHandle();
  if (!dir) return;

  const fileName = `${postId}.html`;

  try {
    await dir.removeEntry(fileName);
    console.log(`정적 글 삭제됨: ${fileName}`);
  } catch (e) {
    // 파일이 없을 수도 있으니 에러는 경고만
    console.warn(`정적 글 파일 없음 또는 삭제 실패: ${fileName}`, e);
  }
}

async function deleteCurrentPost() {
  if (!state.editingPostId) return;

  const postId = state.editingPostId;

  const ok = confirm("이 글을 삭제하시겠습니까?");
  if (!ok) return;

  // 1) posts.json 상태에서 제거
  state.posts = state.posts.filter((p) => p.id !== postId);
  state.editingPostId = null;

  await saveJsonToFile();

  // 2) 로컬 개발 환경이면 정적 파일도 삭제 + sitemap 갱신
  if (isLocalDev) {
    await deleteStaticPostFile(postId);
    await regenerateSitemapOnly();
  }

  // 3) UI 갱신
  renderPostList();

  // 현재 카테고리 영역으로 돌아가기
  const catId = state.currentCategoryId || "all";
  location.hash = `#category/${catId}`;
}


function closeEditor() {
  state.editingPostId = null;
  showView("list");
}

// posts 폴더 선택 (처음 한 번만)
async function ensurePostsDirHandle() {
  if (postsDirHandle) return postsDirHandle;

  if (!window.showDirectoryPicker) {
    alert("이 브라우저에서는 폴더 선택(Directory Picker)을 지원하지 않습니다.");
    return null;
  }

  alert("정적 글 파일을 생성할 /posts 폴더를 선택해주세요.\n(레포 루트의 posts 폴더)");
  try {
    postsDirHandle = await window.showDirectoryPicker();
    return postsDirHandle;
  } catch (e) {
    console.warn("posts 폴더 선택 취소/실패:", e);
    return null;
  }
}

// sitemap.xml 파일 선택 (처음 한 번만)
async function ensureSitemapFileHandle() {
  if (sitemapFileHandle) return sitemapFileHandle;

  if (!window.showOpenFilePicker) {
    alert("이 기능은 Chrome / Edge 같은 Chromium 브라우저에서만 동작합니다.");
    return null;
  }

  alert("sitemap.xml 파일을 선택해주세요. (레포 루트의 sitemap.xml)");
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "XML Files", accept: { "application/xml": [".xml"] } }],
      excludeAcceptAllOption: true,
      multiple: false,
    });
    sitemapFileHandle = handle;
    return sitemapFileHandle;
  } catch (e) {
    console.warn("sitemap.xml 선택 취소/실패:", e);
    return null;
  }
}

// index.html 템플릿 파일 선택 (처음 한 번만)
async function ensureIndexTemplateFileHandle() {
  if (indexTemplateFileHandle) return indexTemplateFileHandle;

  if (!window.showOpenFilePicker) {
    alert("이 기능은 Chrome / Edge 같은 Chromium 브라우저에서만 동작합니다.");
    return null;
  }

  alert("index.html 파일을 선택해주세요. (이걸 그대로 복사해서 글 페이지를 만들거야)");
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "HTML Files", accept: { "text/html": [".html"] } }],
      excludeAcceptAllOption: false,
      multiple: false,
    });
    indexTemplateFileHandle = handle;
    return indexTemplateFileHandle;
  } catch (e) {
    console.warn("index.html 선택 취소/실패:", e);
    return null;
  }
}

// 이미지 폴더 선택 (처음 한 번만)
async function ensureImagesDirHandle() {
  if (imagesDirHandle) return imagesDirHandle;

  if (!window.showDirectoryPicker) {
    alert("이 브라우저에서는 로컬 이미지 저장(Directory Picker)을 지원하지 않습니다.");
    return null;
  }

  alert(
    "이미지를 저장할 폴더를 선택해주세요.\n" +
      "보통 이 레포 루트 안의 images (또는 img) 폴더를 선택하면 됩니다."
  );

  try {
    imagesDirHandle = await window.showDirectoryPicker();
    return imagesDirHandle;
  } catch (e) {
    console.warn("이미지 폴더 선택 취소/실패:", e);
    return null;
  }
}

// 실제로 이미지 파일을 복사해서 삽입
async function insertImageFromLocalFile() {
  // File System Access 지원 안 되는 브라우저 대비
  if (!window.showOpenFilePicker || !window.showDirectoryPicker) {
    const url = prompt("이 브라우저에서는 파일 업로드를 지원하지 않습니다.\n이미지 URL을 직접 입력해주세요.");
    if (url) {
      postContentEditor.focus();
      document.execCommand("insertImage", false, url);
    }
    return;
  }

  // 이미지 폴더 선택 (images / img 등)
  const dirHandle = await ensureImagesDirHandle();
  if (!dirHandle) return;

  try {
    // 업로드할 이미지 파일 선택
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: "Images",
          accept: {
            "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
          },
        },
      ],
      excludeAcceptAllOption: false,
      multiple: false,
    });

    if (!fileHandle) return;

    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();

    // 파일명: 타임스탬프_원본이름 형태로 저장 (이름 중복 방지)
    const timeStamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9_\-.]/g, "_");
    const newFileName = `${timeStamp}_${safeName}`;

    // 선택한 폴더에 새 파일로 쓰기
    const newFileHandle = await dirHandle.getFileHandle(newFileName, {
      create: true,
    });
    const writable = await newFileHandle.createWritable();
    await writable.write(arrayBuffer);
    await writable.close();

    // index.html 기준 상대 경로: "폴더이름/파일명"
    // showDirectoryPicker로 고른 폴더 이름을 그대로 사용
    const folderName = dirHandle.name; // 예: images
    const relativeUrl = `${folderName}/${newFileName}`;

    // 에디터에 <img src="..."> 삽입
    postContentEditor.focus();
    document.execCommand("insertImage", false, relativeUrl);
  } catch (e) {
    console.error("이미지 파일 선택/저장 중 오류:", e);
    alert("이미지 파일을 저장하는 중 오류가 발생했습니다.");
  }
}

// 사이트 기본 URL (robots.txt에 이미 이 값으로 sitemap 등록돼있음)
const SITE_BASE_URL = "https://woong020477.github.io/DevoongLog"; // 필요하면 네 도메인으로 바꿔

function getPostHtmlFileName(post) {
  // 제목 슬러그보다 id가 안정적(중복/한글/특수문자 문제 없음)
  return `${post.id}.html`;
}

function toLastModDate(isoString) {
  // sitemap lastmod는 보통 YYYY-MM-DD 형태를 많이 씀
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function regenerateSitemapOnly() {
  const sitemapHandle = await ensureSitemapFileHandle();
  if (!sitemapHandle) return;

  const xml = buildSitemapXml();
  await writeTextFile(sitemapHandle, xml);
}

function buildSitemapXml() {
  const urls = [];

  // 메인
  urls.push({
    loc: `${SITE_BASE_URL}/index.html`,
    changefreq: "weekly",
    priority: "1.0",
    lastmod: null,
  });

  // 글들
  for (const post of state.posts) {
    urls.push({
      loc: `${SITE_BASE_URL}/posts/${getPostHtmlFileName(post)}`,
      changefreq: "monthly",
      priority: "0.7",
      lastmod: toLastModDate(post.createdAt),
    });
  }

  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`);

  for (const u of urls) {
    lines.push(`  <url>`);
    lines.push(`    <loc>${u.loc}</loc>`);
    if (u.lastmod) lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
    lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
    lines.push(`    <priority>${u.priority}</priority>`);
    lines.push(`  </url>`);
  }

  lines.push(`</urlset>`);
  return lines.join("\n");
}

async function writeTextFile(fileHandle, text) {
  const writable = await fileHandle.createWritable();
  await writable.write(text);
  await writable.close();
}

// index.html “그대로” 복사해서 posts/*.html 만들기
async function buildPostHtmlFromIndexTemplate(post) {
  const templateHandle = await ensureIndexTemplateFileHandle();
  if (!templateHandle) return null;

  const file = await templateHandle.getFile();
  let html = await file.text();

  // 1) 글 페이지에서 상대경로(images/...)가 깨지는 문제 해결
  //    /posts/xxx.html에서 images/... 를 ../images/... 로 해석시키기 위해 base를 ../로 설정
  if (!html.includes("<base ")) {
    html = html.replace(
      /<head(\s*)>/i,
      `<head$1>\n  <base href="../" />`
    );
  }

  // 2) 타이틀을 글 제목으로 바꿔서 SEO/공유 품질 올리기
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(post.title)} · DevoongLog</title>`);

  // 3) 이 페이지가 “이 글을 바로 열어라”를 main.js에 전달
  //    (index 구조는 유지하되, 초기 라우팅만 강제로 post로 보냄)
  const inject = `
  <script>
    // 정적 페이지에서 fetch(posts.json) 없이 바로 렌더링 가능하도록 주입
    window.__STATIC_PREFETCH__ = ${JSON.stringify({
      categories: state.categories,
      posts: state.posts,
    })};
    window.__STATIC_ROUTE__ = ${JSON.stringify({ type: "post", id: post.id })};
  </script>
  `;

  // index.html이 <script src="main.js"></script>를 쓰고 있으니 그 바로 앞에 주입
  if (html.includes('<script src="main.js"></script>')) {
    html = html.replace('<script src="main.js"></script>', `${inject}\n  <script src="main.js"></script>`);
  } else {
    // 혹시 구조가 바뀌면 body 끝에라도 넣기
    html = html.replace(/<\/body>/i, `${inject}\n</body>`);
  }

  // 4) 글 페이지는 읽기전용으로 시작(버튼은 이미 editor-only로 숨겨짐)
  //    그래도 혹시 모르니 body에 class 추가
  html = html.replace(/<body(\s*)>/i, `<body$1 class="read-only">`);

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ===== 뷰 전환 =====

function showView(view) {
  postListView.classList.toggle("hidden", view !== "list");
  postEditorView.classList.toggle("hidden", view !== "editor");
  postDetailView.classList.toggle("hidden", view !== "detail");
}

// ===== 해시 기반 라우팅 =====

// ex) #post/post_l1v2yyn → { type: "post", id: "post_l1v2yyn" }
function getRouteFromHash() {
  const raw = window.location.hash.replace(/^#/, ""); // ex) 'post/post_l1v2yyn'
  if (!raw) return { type: "list", id: null };

  const [type, id] = raw.split("/");

  // 글 상세
  if (type === "post" && id) {
    return { type: "post", id };
  }

  // 카테고리 선택 (#category/all, #category/unity ...)
  if (type === "category") {
    return { type: "category", id: id || "all" };
  }

  return { type: "list", id: null };
}

// 해시가 바뀔 때마다 어떤 화면을 보여줄지 결정
function handleHashChange() {
  const route = getRouteFromHash();

  // 1) 포스트 상세 (#post/xxx)
  if (route.type === "post" && route.id) {
    const post = state.posts.find((p) => p.id === route.id);

    if (post) {
      // 사이드바 카테고리 활성화 맞추기
      state.currentCategoryId = post.categoryId || "all";
      renderCategories();
      openPostDetail(route.id);
      return;
    }
  }

  // 2) 카테고리 선택 (#category/xxx)
  if (route.type === "category") {
    const catId = route.id || "all";

    // 실제 존재하는 카테고리인지 확인
    if (catId === "all") {
      state.currentCategoryId = "all";
    } else if (state.categories.some((c) => c.id === catId)) {
      state.currentCategoryId = catId;
    } else {
      // 이상한 값이면 전체로
      state.currentCategoryId = "all";
    }

    renderCategories();   // 여기서 active 테두리 적용
    renderPostList();     // 여기서 해당 카테고리 글만 필터링
    showView("list");
    document.title =
      state.currentCategoryId === "all"
        ? "DevoongLog"
        : `${getCategoryName(state.currentCategoryId)} · DevoongLog`;
    return;
  }

  // 3) 그 외 (해시 없음, 이상한 값) → 기본: 전체 글 목록
  if (!state.currentCategoryId) {
    state.currentCategoryId = "all";
  }
  renderCategories();
  renderPostList();
  showView("list");
  document.title = "DevoongLog";
}

// ===== 리치 텍스트 툴바 =====

function setupEditorToolbar() {
  // 버튼들(B, I, 정렬, 리스트, 링크, 이미지)
  editorToolbarEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".toolbar-btn");
    if (!btn) return;

    const cmd = btn.getAttribute("data-command");
    if (!cmd) return;

    postContentEditor.focus();

    if (cmd === "createLink") {
      const url = prompt("링크 URL을 입력하세요 (https://...)");
      if (url) {
        document.execCommand("createLink", false, url);
      }
      return;
    }

    if (cmd === "insertImage") {
      // 로컬 개발 환경에서는 이미지 파일을 레포에 바로 저장
      if (isLocalDev) {
        insertImageFromLocalFile();
      } else {
        // GitHub Pages 등 외부에서는 기존처럼 URL 입력만 허용
        const url = prompt("이미지 URL을 입력하세요 (https://...)");
        if (url) {
          postContentEditor.focus();
          document.execCommand("insertImage", false, url);
        }
      }
      return;
    }

    document.execCommand(cmd, false, null);
  });

  // 글자 크기 선택 (1~7 → 나중에 CSS로 px 매핑)
  if (toolbarFontSize) {
    toolbarFontSize.addEventListener("change", () => {
      const value = toolbarFontSize.value;
      postContentEditor.focus();
      if (!value) {
        // "기본" 선택 시에는 그냥 아무 것도 안 함 (기존 크기 유지)
        return;
      }
      document.execCommand("fontSize", false, value);
    });
  }

  // 색상 프리셋 클릭
  if (toolbarColorPalette) {
    toolbarColorPalette.addEventListener("click", (e) => {
      const swatch = e.target.closest(".color-swatch");
      if (!swatch) return;
      const color = swatch.dataset.color;
      if (!color) return;

      postContentEditor.focus();
      document.execCommand("foreColor", false, color);
    });
  }
}

// ===== 이벤트 =====

function setupEventListeners() {
  // 파일 연결 버튼
  connectFileBtn.addEventListener("click", loadFromConnectedFile);

  // 카테고리
  addCategoryBtn.addEventListener("click", () => openCategoryForm(null));
  categorySaveBtn.addEventListener("click", () => saveCategory());
  categoryCancelBtn.addEventListener("click", () => closeCategoryForm());

  // 글
  newPostBtn.addEventListener("click", () => openEditorForNewPost());
  postSaveBtn.addEventListener("click", () => savePost());
  postCancelBtn.addEventListener("click", () => closeEditor());

  backToListBtn.addEventListener("click", () => {
    const catId = state.currentCategoryId || "all";
    location.hash = `#category/${catId}`;
  });
  detailEditBtn.addEventListener("click", () => openEditorForEdit());
  detailDeleteBtn.addEventListener("click", () => deleteCurrentPost());

  // 에디터 툴바
  setupEditorToolbar();
}

// ===== 초기화 =====

async function init() {
  await loadInitialState();
  setupEventListeners();

  // 해시 라우팅 이벤트 등록
  window.addEventListener("hashchange", handleHashChange);

  // 첫 진입 시 현재 해시(#category/..., #post/...) 기준으로 화면 결정
  handleHashChange();

  // 정적 글 페이지(posts/*.html)에서 바로 해당 글 상세로 이동
  if (window.__STATIC_ROUTE__?.type === "post" && window.__STATIC_ROUTE__?.id) {
    const post = state.posts.find(p => p.id === window.__STATIC_ROUTE__.id);
    if (post) {
      state.currentCategoryId = post.categoryId || "all";
      renderCategories();
      openPostDetail(post.id);
    }
  }

  if (!isLocalDev) {
    // 외부 접속: 읽기 전용 모드
    document.body.classList.add("read-only");
    fileStatusText.textContent = "";
  } else {
    // 로컬: 편집 가능 모드
    fileStatusText.textContent =
      "로컬 편집 모드 (posts.json 연결 후 저장 가능)";
  }
}

document.addEventListener("DOMContentLoaded", init);
