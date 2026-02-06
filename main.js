// Установить workerSrc после загрузки библиотеки
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// Состояние приложения
let currentPDF = null;
let isProcessing = false;
let currentFileName = "";

// Элементы DOM
const pdfFileInput = document.getElementById("pdfFile");
const pdfViewer = document.getElementById("pdfViewer");
const statusText = document.getElementById("statusText");
const pageCount = document.getElementById("pageCount");
const fileName = document.getElementById("fileName");
const docStatus = document.getElementById("docStatus");
const emptyState = document.getElementById("emptyState");
const clearBtn = document.getElementById("clearBtn");

const scale = 1.5; // Масштаб отображения

// Обработка выбора файла - ТОЛЬКО ОДИН ФАЙЛ
pdfFileInput.addEventListener("change", async function (e) {
  const files = e.target.files;

  // Проверяем, что выбран ровно один файл
  if (files.length === 0) return;

  // Если уже обрабатывается другой файл
  if (isProcessing) {
    alert("Пожалуйста, дождитесь окончания обработки текущего файла");
    return;
  }

  const file = files[0];

  // Проверяем тип файла
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    alert("Пожалуйста, выберите PDF файл");
    this.value = ""; // Сбрасываем input
    return;
  }

  // Начинаем обработку
  isProcessing = true;
  currentFileName = file.name;

  // Обновляем UI
  updateDocumentInfo("Загрузка...", "0", "Обработка");
  statusText.textContent = `Загрузка: ${file.name}...`;
  emptyState.style.display = "none";

  try {
    // Очищаем предыдущий документ
    clearCurrentDocument();

    // Читаем файл
    const arrayBuffer = await readFileAsArrayBuffer(file);

    // Загружаем PDF
    await loadPDFDocument(arrayBuffer);

    // Обновляем статус
    statusText.textContent = `Документ "${file.name}" успешно загружен`;
    docStatus.textContent = "Загружен";
  } catch (error) {
    console.error("Ошибка загрузки PDF:", error);
    alert(`Ошибка загрузки PDF файла: ${error.message}`);
    statusText.textContent = "Ошибка загрузки файла";
    docStatus.textContent = "Ошибка";
    emptyState.style.display = "block";
  } finally {
    isProcessing = false;
  }
});

// Кнопка очистки
clearBtn.addEventListener("click", function () {
  if (currentPDF) {
    if (confirm("Вы уверены, что хотите очистить текущий документ?")) {
      clearCurrentDocument();
      pdfFileInput.value = "";
      statusText.textContent = "Документ очищен. Выберите новый PDF файл";
    }
  }
});

// Чтение файла как ArrayBuffer
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Загрузка PDF документа
async function loadPDFDocument(data) {
  try {
    // Загружаем PDF через pdf.js
    const loadingTask = pdfjsLib.getDocument({ data });
    currentPDF = await loadingTask.promise;

    // Обновляем информацию о документе
    updateDocumentInfo(
      currentFileName,
      currentPDF.numPages,
      "Обработка страниц...",
    );

    // Рендерим все страницы
    await renderAllPages();

    // Финальное обновление статуса
    updateDocumentInfo(currentFileName, currentPDF.numPages, "Готов");
    statusText.textContent = `Документ "${currentFileName}" (${currentPDF.numPages} стр.) готов к работе`;
  } catch (error) {
    currentPDF = null;
    throw error;
  }
}

// Рендеринг всех страниц документа
async function renderAllPages() {
  // Очищаем контейнер
  pdfViewer.innerHTML = "";

  // Создаем контейнер для всех страниц
  const pagesContainer = document.createElement("div");
  pagesContainer.className = "pages-container";

  // Рендерим каждую страницу
  for (let pageNum = 1; pageNum <= currentPDF.numPages; pageNum++) {
    try {
      const page = await currentPDF.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });

      // Создаем контейнер для страницы
      const pageContainer = createPageContainer(pageNum, viewport);

      // Создаем canvas
      const canvas = createPageCanvas(pageNum, viewport);

      // Создаем overlay для выделения
      const overlay = createSelectionOverlay(pageNum);

      // Добавляем элементы в контейнер
      const canvasWrapper = document.createElement("div");
      canvasWrapper.style.position = "relative";
      canvasWrapper.style.display = "inline-block";
      canvasWrapper.appendChild(canvas);
      canvasWrapper.appendChild(overlay);

      pageContainer.appendChild(canvasWrapper);
      pagesContainer.appendChild(pageContainer);

      // Рендерим страницу на canvas
      await renderPageToCanvas(page, canvas, viewport);

      // Настраиваем обработчики событий
      setupPageEvents(pageNum, canvas, overlay);

      // Обновляем статус прогресса
      if (pageNum % 5 === 0 || pageNum === currentPDF.numPages) {
        statusText.textContent = `Обработка страниц: ${pageNum}/${currentPDF.numPages}`;
      }
    } catch (error) {
      console.error(`Ошибка рендеринга страницы ${pageNum}:`, error);
      // Продолжаем с остальными страницами
    }
  }

  pdfViewer.appendChild(pagesContainer);
}

// Создание контейнера для страницы
function createPageContainer(pageNum, viewport) {
  const container = document.createElement("div");
  container.className = "page-container";
  container.id = `page-${pageNum}`;
  container.dataset.pageNumber = pageNum;

  // Номер страницы
  const numberLabel = document.createElement("div");
  numberLabel.className = "page-number";
  numberLabel.textContent = `Страница ${pageNum}`;
  container.appendChild(numberLabel);

  return container;
}

// Создание canvas для страницы
function createPageCanvas(pageNum, viewport) {
  const canvas = document.createElement("canvas");
  canvas.className = "pdf-canvas";
  canvas.dataset.pageNumber = pageNum;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  return canvas;
}

// Создание overlay для выделения
function createSelectionOverlay(pageNum) {
  const overlay = document.createElement("div");
  overlay.className = "selection-overlay";
  overlay.id = `overlay-${pageNum}`;
  return overlay;
}

// Рендеринг страницы на canvas
async function renderPageToCanvas(page, canvas, viewport) {
  const context = canvas.getContext("2d");
  const renderContext = {
    canvasContext: context,
    viewport: viewport,
  };

  return page.render(renderContext).promise;
}

// Настройка обработчиков событий для страницы
function setupPageEvents(pageNum, canvas, overlay) {
  let isSelecting = false;
  let startX = 0,
    startY = 0;
  let pageRect = null;

  canvas.addEventListener("mousedown", function (e) {
    e.stopPropagation();

    pageRect = canvas.getBoundingClientRect();
    startX = e.clientX - pageRect.left;
    startY = e.clientY - pageRect.top;
    isSelecting = true;

    // Активируем текущую страницу
    deactivateAllPages();
    document.getElementById(`page-${pageNum}`).classList.add("active");

    // Показываем overlay
    overlay.style.left = startX + "px";
    overlay.style.top = startY + "px";
    overlay.style.width = "0px";
    overlay.style.height = "0px";
    overlay.style.display = "block";

    statusText.textContent = `Выделение на странице ${pageNum} - тяните мышку`;
  });

  canvas.addEventListener("mousemove", function (e) {
    if (!isSelecting || !pageRect) return;

    const currentX = e.clientX - pageRect.left;
    const currentY = e.clientY - pageRect.top;

    const width = currentX - startX;
    const height = currentY - startY;

    // Обновляем overlay
    overlay.style.width = Math.abs(width) + "px";
    overlay.style.height = Math.abs(height) + "px";

    if (width < 0) overlay.style.left = currentX + "px";
    if (height < 0) overlay.style.top = currentY + "px";
  });

  canvas.addEventListener("mouseup", function (e) {
    if (!isSelecting || !pageRect) return;

    isSelecting = false;
    const endX = e.clientX - pageRect.left;
    const endY = e.clientY - pageRect.top;

    // Рассчитываем координаты
    const x1 = Math.min(startX, endX);
    const y1 = Math.min(startY, endY);
    const x2 = Math.max(startX, endX);
    const y2 = Math.max(startY, endY);

    // Показываем результат
    showSelectionResult(pageNum, x1, y1, x2, y2);

    // Скрываем overlay через некоторое время
    setTimeout(() => {
      overlay.style.display = "none";
      document.getElementById(`page-${pageNum}`).classList.remove("active");
    }, 2000);
  });

  canvas.addEventListener("mouseleave", function () {
    if (isSelecting) {
      isSelecting = false;
      overlay.style.display = "none";
      document.getElementById(`page-${pageNum}`).classList.remove("active");
      statusText.textContent = "Выделение отменено";
    }
  });
}

// Показать результат выделения
function showSelectionResult(pageNum, x1, y1, x2, y2) {
  const width = x2 - x1;
  const height = y2 - y1;

  // Формируем сообщение для alert
  const scaledX1 = Math.round(x1 / scale);
  const scaledY1 = Math.round(y1 / scale);
  const scaledX2 = Math.round(x2 / scale);
  const scaledY2 = Math.round(y2 / scale);

  const alertMessage =
    `📄 ВЫДЕЛЕНИЕ НА СТРАНИЦЕ #${pageNum}\n` +
    `══════════════════════════════\n\n` +
    `📏 Относительно отображения:\n` +
    `   X₁: ${Math.round(x1)} px, Y₁: ${Math.round(y1)} px\n` +
    `   X₂: ${Math.round(x2)} px, Y₂: ${Math.round(y2)} px\n\n` +
    `📐 Размер области:\n` +
    `   Ширина: ${Math.round(width)} px\n` +
    `   Высота: ${Math.round(height)} px\n` +
    `   Площадь: ${Math.round(width * height)} px²\n\n` +
    `🎯 В координатах PDF:\n` +
    `   X: ${scaledX1} - ${scaledX2}\n` +
    `   Y: ${scaledY1} - ${scaledY2}\n\n` +
    `📌 Номер страницы: ${pageNum}`;

  // Показываем alert
  setTimeout(() => {
    alert(alertMessage);
    statusText.textContent = `Выделение завершено на странице ${pageNum}`;
  }, 50);
}

// Деактивировать все страницы
function deactivateAllPages() {
  document.querySelectorAll(".page-container").forEach((container) => {
    container.classList.remove("active");
  });
}

// Обновить информацию о документе
function updateDocumentInfo(name, pages, status) {
  fileName.textContent = name || "Нет файла";
  pageCount.textContent = pages || "0";
  docStatus.textContent = status || "Ожидание";
}

// Очистить текущий документ
function clearCurrentDocument() {
  pdfViewer.innerHTML = `
                <div class="empty-state" id="emptyState">
                    <span>📄</span>
                    <h3>PDF файл не загружен</h3>
                    <p>Выберите PDF файл для начала работы</p>
                </div>
            `;

  currentPDF = null;
  currentFileName = "";

  updateDocumentInfo("Нет файла", "0", "Ожидание загрузки");
  statusText.textContent = "Готов к загрузке PDF файла";
}

// Предотвращаем перетаскивание файлов на страницу (чтобы не загружать несколько)
document.addEventListener("dragover", function (e) {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener("drop", function (e) {
  e.preventDefault();
  e.stopPropagation();
  alert("Пожалуйста, используйте кнопку загрузки для выбора одного PDF файла");
});

// Инициализация
window.addEventListener("load", function () {
  statusText.textContent = "Готов к загрузке PDF файла";
  console.log("PDF Selection Tool готов к работе");
});
