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
const toolbarColorInput = document.getElementById("toolbarColorInput");
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
    state.categories = [
      { id: "unity", name: "Unity" },
      { id: "unreal", name: "Unreal" },
      { id: "backend", name: "Backend" },
      { id: "etc", name: "기타" },
    ];
    state.posts = [
      {
        id: generateId("post"),
        title: "블로그를 시작하며",
        categoryId: "etc",
        contentHtml:
          "<p>posts.json을 아직 연결하지 않았거나 로드에 실패했습니다.</p>" +
          "<p>우측 상단의 <b>posts.json 연결</b> 버튼을 눌러 로컬 레포의 posts.json을 선택한 뒤 저장해 주세요.</p>",
        createdAt: new Date().toISOString(),
      },
    ];
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
    state.currentCategoryId = "all";
    renderCategories();
    renderPostList();
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
      state.currentCategoryId = cat.id;
      renderCategories();
      renderPostList();
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
    const excerpt = text.length > 80 ? text.slice(0, 80) + "..." : text;

    card.innerHTML = `
      <h3 class="post-title">${post.title}</h3>
      <div class="post-meta-line">
        <span class="category-pill">${categoryName}</span>
        <span>${dateStr}</span>
      </div>
      <p class="post-excerpt">${excerpt}</p>
    `;

    card.addEventListener("click", () => openPostDetail(post.id));

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
      post.createdAt = new Date().toISOString();
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
  renderPostList();
  openPostDetail(state.editingPostId);
}

async function deleteCurrentPost() {
  if (!state.editingPostId) return;

  const ok = confirm("이 글을 삭제하시겠습니까?");
  if (!ok) return;

  state.posts = state.posts.filter((p) => p.id !== state.editingPostId);
  state.editingPostId = null;

  await saveJsonToFile();
  renderPostList();
  showView("list");
}

function closeEditor() {
  state.editingPostId = null;
  showView("list");
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

// ===== 뷰 전환 =====

function showView(view) {
  postListView.classList.toggle("hidden", view !== "list");
  postEditorView.classList.toggle("hidden", view !== "editor");
  postDetailView.classList.toggle("hidden", view !== "detail");
}

// ===== 리치 텍스트 툴바 =====

function setupEditorToolbar() {
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

  toolbarColorInput.addEventListener("input", () => {
    postContentEditor.focus();
    document.execCommand("foreColor", false, toolbarColorInput.value);
  });
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

  backToListBtn.addEventListener("click", () => showView("list"));
  detailEditBtn.addEventListener("click", () => openEditorForEdit());
  detailDeleteBtn.addEventListener("click", () => deleteCurrentPost());

  // 에디터 툴바
  setupEditorToolbar();
}

// ===== 초기화 =====

async function init() {
  await loadInitialState();
  setupEventListeners();
  renderCategories();
  renderPostList();
  showView("list");

  if (!isLocalDev) {
    // 외부 접속: 읽기 전용 모드
    document.body.classList.add("read-only");
    fileStatusText.textContent = "";
  } else {
    // 로컬: 편집 가능 모드
    fileStatusText.textContent = "로컬 편집 모드 (posts.json 연결 후 저장 가능)";
  }
}

document.addEventListener("DOMContentLoaded", init);
