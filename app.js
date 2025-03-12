// app.js

// === Global State ===
const STORAGE_CATEGORIES_KEY = 'categories';
const STORAGE_DISCOUNTS_KEY = 'discounts';
// const DATA_JSON_URL = 'data.json'; // Удалено, т.к. загрузка теперь через импорт

let categories = []; // Инициализируем как пустой массив
let discounts = {};
let productsPerPage = 10;
let currentPage = 1;

// === DOM Elements (Cached) ===
const dom = {
    // Authentication
    loginForm: document.getElementById('login-form'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    loginButton: document.getElementById('login-button'),

    // Admin Content
    adminContent: document.getElementById('admin-content'),

    // Category
    categoryNameInput: document.getElementById('categoryName'),
    addCategoryButton: document.getElementById('add-category-button'),
    categoryList: document.getElementById('categoryList'),

    // Product
    productCategorySelect: document.getElementById('productCategory'),
    productNameInput: document.getElementById('productName'),
    productPriceInput: document.getElementById('productPrice'),
    addProductButton: document.getElementById('add-product-button'),
    productList: document.getElementById('productList'),

    // Filters
    categoryFilter: document.getElementById('categoryFilter'),
    priceFilter: document.getElementById('priceFilter'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    resetFiltersButton: document.getElementById('reset-filters-button'),

    // Discount
    discountProductSelect: document.getElementById('discountProduct'),
    discountAmountInput: document.getElementById('discountAmount'),
    addDiscountButton: document.getElementById('add-discount-button'),

    // Export/Import
    exportDataButton: document.getElementById('export-data-button'),
    exportOptions: document.getElementById('export-options'),
    exportFormat: document.getElementById('export-format'),
    exportButton: document.getElementById('export-button'),
    importDataButton: document.getElementById('import-data-button'),
    importFile: document.getElementById('import-file'),

    // Modals
    editProductModal: document.getElementById('editProductModal'),
    editProductNameInput: document.getElementById('editProductName'),
    editProductPriceInput: document.getElementById('editProductPrice'),
    editProductDiscountInput: document.getElementById('editProductDiscountInput'),
    editProductError: document.getElementById('edit-product-error'),
    saveEditedProductButton: document.getElementById('save-edited-product-button'),
    deleteProductModal: document.getElementById('deleteProductModal'),
    deleteProductConfirmButton: document.getElementById('delete-product-confirm-button'),
    clearDataModal: document.getElementById('clearDataModal'),
    clearDataCodeInput: document.getElementById('clearDataCode'),
    clearDataConfirmButton: document.getElementById('clear-data-confirm-button'),

    // Pagination
    pagination: document.getElementById('pagination'),

    // Templates
    productRowTemplate: document.getElementById('productRowTemplate').innerHTML,
    categoryListItemTemplate: document.getElementById('categoryListItemTemplate').innerHTML,

    loading: document.getElementById('loading'),
    authSection: document.getElementById('auth-section'), // Cache auth-section
    categoriesContainer: document.getElementById('categories') // Добавлено
};

// === Constants ===
const CLEAR_DATA_CODE = "admin123";
const DEFAULT_PRODUCT_PRICE = 0;
const DEFAULT_PRODUCT_DISCOUNT = 0;
const DEFAULT_CATEGORY_PRODUCT_COUNT = 0;

// === Utility Functions ===
function safeParseFloat(value, defaultValue = DEFAULT_PRODUCT_PRICE) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

function showOrHideElement(element, show) {
    // Check if element is valid before accessing 'style' property
    if (element) {
        element.style.display = show ? 'block' : 'none';
    } else {
        console.warn("Element is null or undefined:", element);
    }
}

function updateLocalStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function getDataFromLocalStorage(key, defaultValue) {
    const storedData = localStorage.getItem(key);
    return storedData ? JSON.parse(storedData) : defaultValue;
}

// === Authentication ===
function handleLogin() {
    if (checkCredentials(dom.usernameInput.value, dom.passwordInput.value)) {
        setAuthToken('admin_token');
        showAdminContent();
        initAdminPanel();
    } else {
        showToast('Неверное имя пользователя или пароль.', 'red');
    }
}

// === Data Loading (Removed loading from data.json) ===
// async function loadDataFromJson() { // Теперь не используется
//     showLoading(true);
//     try {
//         const response = await fetch(DATA_JSON_URL);
//         if (!response.ok) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//         categories = await response.json();
//         saveCategories(); // Save to local storage
//         showToast('Данные загружены из data.json', 'green');
//     } catch (error) {
//         console.error('Failed to load data from data.json:', error);
//         showToast('Не удалось загрузить данные из data.json', 'red');
//     } finally {
//         showLoading(false);
//     }
// }

// === Initialization ===
document.addEventListener('DOMContentLoaded', () => {
    initAuth();

    if (isLoggedIn()) {
        showAdminContent();
        initAdminPanel();
    } else {
        showLoginForm();
    }
});

function initAuth() {
    dom.loginButton.addEventListener('click', handleLogin);
}

function showLoginForm() {
    showOrHideElement(dom.authSection, true); // Use dom object
    showOrHideElement(dom.adminContent, false); // Use dom object
}

function showAdminContent() {
    showOrHideElement(dom.authSection, false); // Use dom object
    showOrHideElement(dom.adminContent, true); // Use dom object
}

function showLoading(show) {
    showOrHideElement(dom.loading, show);
}

async function initAdminPanel() {
    // Load existing data from localStorage
    categories = getDataFromLocalStorage(STORAGE_CATEGORIES_KEY, []);

    // If no data in local storage, leave categories as empty array.  The import button will handle initial loading.
    // if (categories.length === 0) { // Теперь загрузки из data.json при старте нет
    //     await loadDataFromJson();
    // }
    // else { //  Оставляем загрузку из localStorage
    renderCategories();
    renderProducts();
    renderDiscountProductSelect();
    // }
    // Input Masks
    $('#productPrice').inputmask({
        alias: 'decimal',
        groupSeparator: '',
        digits: 2,
        radixPoint: '.',
        allowMinus: false,
    });

    $('#editProductPrice').inputmask({
        alias: 'decimal',
        groupSeparator: '',
        digits: 2,
        radixPoint: '.',
        allowMinus: false,
    });

    // Event Listeners
    // Use optional chaining and null check
    dom.addCategoryButton?.addEventListener('click', addCategory);
    dom.addProductButton?.addEventListener('click', addProduct);
    dom.saveEditedProductButton?.addEventListener('click', saveEditedProduct);
    dom.deleteProductConfirmButton?.addEventListener('click', deleteProduct);
    dom.resetFiltersButton?.addEventListener('click', resetFilters);
    dom.addDiscountButton?.addEventListener('click', addDiscount);
    dom.exportDataButton?.addEventListener('click', toggleExportOptions);
    dom.exportButton?.addEventListener('click', exportData);
    dom.importFile?.addEventListener('change', importData);
    dom.clearDataConfirmButton?.addEventListener('click', clearData);
    dom.productList?.addEventListener('click', handleProductListClick);
    dom.categoryList?.addEventListener('click', handleCategoryListClick);

    // Initial Render
    renderCategories();
    renderProducts();
    renderDiscountProductSelect();

    // Initialize Bootstrap modal *after* the DOM is ready, and before we populate it.
    $('#editProductModal').on('shown.bs.modal', function () {
        // This code will run after the modal is fully shown
        // You can now safely set the input values

        // Also, re-populate the input values after the modal is shown
        const catIndex = dom.editProductModal.dataset.catIndex;
        const prodIndex = dom.editProductModal.dataset.prodIndex;
        if (catIndex !== undefined && prodIndex !== undefined) {
            const product = categories[catIndex]?.products[prodIndex]; // Optional chaining and null check
            if (product) {
                dom.editProductNameInput.value = product.name;
                dom.editProductPriceInput.value = product.price;
                dom.editProductDiscountInput.value = discounts[catIndex]?.[prodIndex] ?? DEFAULT_PRODUCT_DISCOUNT;
            } else {
                 console.warn("Product not found for editing (inside shown.bs.modal)");
            }
        } else {
             console.warn("Missing catIndex or prodIndex in shown.bs.modal");
        }
    });
}

// === Event Handlers ===
function handleProductListClick(event) {
    const target = event.target;
    if (target.classList.contains('edit-product')) {
        const [catIndex, prodIndex] = target.dataset.id.split('-');
        console.log("handleProductListClick - catIndex:", catIndex, "prodIndex:", prodIndex); // Добавлено для отладки
        showEditProductModal(catIndex, prodIndex);
    } else if (target.classList.contains('delete-product')) {
        const [catIndex, prodIndex] = target.dataset.id.split('-');
        showDeleteProductModal(catIndex, prodIndex);
    }
}

function handleCategoryListClick(event) {
    if (event.target.classList.contains('delete-category')) {
        const index = event.target.parentElement.dataset.index;
        deleteCategory(index);
    }
}

// === Category Management ===
function addCategory() {
    const name = dom.categoryNameInput.value.trim();
    if (!name) {
        showToast('Название категории не может быть пустым.', 'red');
        return;
    }
    if (categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
        showToast('Категория с таким названием уже существует.', 'red');
        return;
    }
    categories.push({
        name: name,
        products: []
    });
    saveCategories();
    dom.categoryNameInput.value = '';
}

function deleteCategory(index) {
    if (confirm('Вы уверены, что хотите удалить эту категорию? Все товары в ней также будут удалены.')) {
        categories.splice(index, 1);
        saveCategories();
    }
}

// === Product Management ===
function addProduct() {
    const categoryIndex = dom.productCategorySelect.value;
    const name = dom.productNameInput.value.trim();
    const price = safeParseFloat(dom.productPriceInput.value);

    if (!name || price <= DEFAULT_PRODUCT_PRICE) {
        showToast('Пожалуйста, введите корректное название и цену товара.', 'red');
        return;
    }

    if (!categoryIndex) {
        showToast('Пожалуйста, выберите категорию.', 'red');
        return;
    }

    categories[categoryIndex].products.push({
        name: name,
        price: price
    });

    saveCategories();
    dom.productNameInput.value = '';
    dom.productPriceInput.value = '';
    showToast('Товар успешно добавлен.', 'green');
}

function showEditProductModal(catIndex, prodIndex) {
    // This is now handled in shown.bs.modal, to ensure the inputs exist
    // and the modal is fully shown before we set values.
    const modal = new bootstrap.Modal(dom.editProductModal);
    dom.editProductModal.dataset.catIndex = catIndex;
    dom.editProductModal.dataset.prodIndex = prodIndex;
    console.log("showEditProductModal - catIndex:", catIndex, "prodIndex:", prodIndex);  // Добавлено для отладки
    modal.show();


}

function saveEditedProduct() {
    const catIndex = dom.editProductModal.dataset.catIndex;
    const prodIndex = dom.editProductModal.dataset.prodIndex;
    if (!catIndex || !prodIndex) {
        console.error("Missing catIndex or prodIndex in saveEditedProduct");
        return;
    }

    const newName = dom.editProductNameInput.value.trim();
    const newPrice = safeParseFloat(dom.editProductPriceInput.value);
    const newDiscount = safeParseFloat(dom.editProductDiscountInput.value);

    if (!newName || newPrice <= DEFAULT_PRODUCT_PRICE) {
        dom.editProductError.textContent = 'Пожалуйста, введите корректное название и цену товара.';
        return;
    }
    dom.editProductError.textContent = '';

    const product = categories[catIndex].products[prodIndex];
    product.name = newName;
    product.price = newPrice;

    if (!discounts[catIndex]) {
        discounts[catIndex] = {};
    }
    discounts[catIndex][prodIndex] = newDiscount;

    updateLocalStorage(STORAGE_DISCOUNTS_KEY, discounts);
    saveCategories();
    bootstrap.Modal.getInstance(dom.editProductModal).hide();
}

function showDeleteProductModal(catIndex, prodIndex) {
    const modal = new bootstrap.Modal(dom.deleteProductModal);
    dom.deleteProductModal.dataset.catIndex = catIndex;
    dom.deleteProductModal.dataset.prodIndex = prodIndex;
    modal.show();
}

function deleteProduct() {
    const catIndex = dom.deleteProductModal.dataset.catIndex;
    const prodIndex = dom.deleteProductModal.dataset.prodIndex;
    if (!catIndex || !prodIndex) {
        console.error("Missing catIndex or prodIndex in deleteProduct");
        return;
    }

    categories[catIndex].products.splice(prodIndex, 1);

    if (discounts[catIndex]?.[prodIndex]) {
        delete discounts[catIndex][prodIndex];
        updateLocalStorage(STORAGE_DISCOUNTS_KEY, discounts);
    }

    saveCategories();
    bootstrap.Modal.getInstance(dom.deleteProductModal).hide();
}

// === Rendering ===
function renderCategories() {
    if (!dom.categoryList) return;

    dom.categoryList.innerHTML = categories.map((cat, index) => {
        const template = Handlebars.compile(dom.categoryListItemTemplate);
        return template({
            name: cat.name,
            productCount: cat.products.length,
            index: index
        });
    }).join('');

    const categoryOptions = categories.map((cat, index) => `<option value="${index}">${cat.name}</option>`).join('');
    dom.productCategorySelect.innerHTML = `<option value="">Выберите категорию</option>${categoryOptions}`;
    dom.categoryFilter.innerHTML = `<option value="">Все категории</option>${categoryOptions}`;

     // Инициализация Slick Carousel здесь, после того, как категории отрисованы
     if (dom.categoriesContainer && dom.categoriesContainer.length > 0) { // Добавлена проверка
        $(dom.categoriesContainer).slick({
            infinite: true,
            slidesToShow: 3,
            slidesToScroll: 1,
            arrows: true,
            dots: true,
            prevArrow: '<button type="button" class="slick-prev"><i class="fas fa-chevron-left"></i></button>',
            nextArrow: '<button type="button" class="slick-next"><i class="fas fa-chevron-right"></i></button>',
            responsive: [
                { breakpoint: 992, settings: { slidesToShow: 2 } },
                { breakpoint: 768, settings: { slidesToShow: 1 } }
            ]
        });
    }
}

function renderProducts() {
    const searchTerm = dom.searchInput.value.toLowerCase();
    const categoryFilterValue = dom.categoryFilter.value;
    const priceFilterValue = dom.priceFilter.value;
    const sortBy = dom.sortSelect.value;

    let products = [];
    categories.forEach((cat, catIndex) => {
        cat.products.forEach((prod, prodIndex) => {
            let passesFilters = true;

            if (categoryFilterValue && catIndex != categoryFilterValue) {
                passesFilters = false;
            }

            if (priceFilterValue) {
                const [minPrice, maxPrice] = priceFilterValue.split('-');
                const price = prod.price;

                if (maxPrice === undefined) {
                    if (price <= parseFloat(minPrice)) {
                        passesFilters = false;
                    }
                } else {
                    if (price < parseFloat(minPrice) || price > parseFloat(maxPrice)) {
                        passesFilters = false;
                    }
                }
            }

            if (!prod.name.toLowerCase().includes(searchTerm)) {
                passesFilters = false;
            }

            if (passesFilters) {
                products.push({
                    catIndex,
                    prodIndex,
                    ...prod
                });
            }
        });
    });

    products.sort((a, b) => sortBy === 'name' ? a.name.localeCompare(b.name) : a.price - b.price);

    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginatedProducts = products.slice(startIndex, endIndex);

    const template = Handlebars.compile(dom.productRowTemplate);
    dom.productList.innerHTML = paginatedProducts.map(item => {
        const discount = discounts[item.catIndex]?.[item.prodIndex] ?? DEFAULT_PRODUCT_DISCOUNT;
        const discountedPrice = item.price - discount;

        return template({
            ...item,
            discount: discount,
            discountedPrice: discountedPrice,
            categoryName: categories[item.catIndex].name
        });
    }).join('');
    renderPagination(products.length);
}

function renderDiscountProductSelect() {
    dom.discountProductSelect.innerHTML =
        '<option value="">Выберите товар для скидки</option>' +
        categories.reduce((options, cat, catIndex) =>
            options + cat.products.map((prod, prodIndex) =>
                `<option value="${catIndex}-${prodIndex}">${cat.name} - ${prod.name} (${prod.price} ₽)</option>`
            ).join(''), '');
}

// === Discounts ===
function addDiscount() {
    const [catIndex, prodIndex] = dom.discountProductSelect.value.split('-');
    const discountAmount = safeParseFloat(dom.discountAmountInput.value);

    if (discountAmount <= DEFAULT_PRODUCT_PRICE) {
        showToast('Сумма скидки должна быть положительным числом.', 'red');
        return;
    }

    if (!categories[catIndex]?.products[prodIndex]) {
        showToast('Товар не найден.', 'red');
        return;
    }

    const productPrice = categories[catIndex].products[prodIndex].price;
    if (discountAmount >= productPrice) {
        showToast('Сумма скидки не может быть больше цены товара', 'red');
        return;
    }

    if (!discounts[catIndex]) {
        discounts[catIndex] = {};
    }
    discounts[catIndex][prodIndex] = discountAmount;
    updateLocalStorage(STORAGE_DISCOUNTS_KEY, discounts);

    renderProducts();
    renderDiscountProductSelect();
    dom.discountAmountInput.value = '';
}

// === Export/Import ===
function toggleExportOptions() {
    showOrHideElement(dom.exportOptions, dom.exportOptions.style.display === 'none');
}

function exportData() {
    showLoading(true);
    const format = dom.exportFormat.value;
    let dataStr = "";
    let fileName = "data.";

    if (format === "json") {
        dataStr = JSON.stringify({categories, discounts}); // Export both categories and discounts
        fileName += "json";
    } else if (format === "csv") {
        dataStr = "Категория,Товар,Цена\n";
        categories.forEach(cat => {
            cat.products.forEach(prod => {
                dataStr += `${cat.name},${prod.name},${prod.price}\n`;
            });
        });
        fileName += "csv";
    }

    const blob = new Blob([dataStr], {
        type: `text/${format === 'json' ? 'json' : 'csv'};charset=utf-8`
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showLoading(false);
}

function importData(e) {
    showLoading(true);
    const file = e.target.files[0];
    if (!file) {
        showLoading(false);
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            let importedData = null;
            if (file.name.endsWith('.json')) {
                importedData = JSON.parse(e.target.result);
                if (importedData.categories !== undefined) { // Check if the structure has categories and discounts
                    categories = importedData.categories;
                    discounts = importedData.discounts || {}; // Handle missing discounts
                } else {
                    categories = importedData; // Assume it's just the categories array
                }
            } else if (file.name.endsWith('.csv')) {
                importedData = parseCSV(e.target.result);
                categories = importedData;
                discounts = {}; // Clear discounts on CSV import, as they are not in CSV
            } else {
                showToast('Неподдерживаемый формат файла. Пожалуйста, загрузите файл JSON или CSV.', 'red');
                showLoading(false);
                return;
            }

            saveCategories(); // Save to local storage and re-render.

        } catch (error) {
            console.error("Import error:", error); // Log the error for debugging
            showToast('Ошибка при импорте данных: файл не соответствует ожидаемому формату.', 'red');
        } finally {
            showLoading(false);
            e.target.value = '';
        }
    };

    reader.onerror = () => {
        showToast('Ошибка при чтении файла.', 'red');
        showLoading(false);
        e.target.value = '';
    };

    reader.readAsText(file);
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const header = lines[0].split(',');
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === header.length) {
            const entry = {};
            for (let j = 0; j < header.length; j++) {
                entry[header[j].trim()] = values[j].trim();
            }
            data.push(entry);
        }
    }

    const jsonData = [];
    let currentCategory = null;

    data.forEach(item => {
        const categoryName = item.Категория;
        const productName = item.Товар;
        const productPrice = parseFloat(item.Цена);

        if (categoryName) {
            currentCategory = {
                name: categoryName,
                products: []
            };
            jsonData.push(currentCategory);
        }

        if (productName && !isNaN(productPrice)) {
            currentCategory.products.push({
                name: productName,
                price: productPrice
            });
        }
    });

    return jsonData;
}

// === Pagination ===
function renderPagination(totalProducts) {
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    let paginationHtml = '';

    if (totalPages <= 1) {
        dom.pagination.innerHTML = '';
        return;
    }

    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (currentPage > 1) {
        paginationHtml += createPaginationButton(currentPage - 1, '&laquo;');
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += createPaginationButton(i, i.toString(), i === currentPage);
    }

    if (currentPage < totalPages) {
        paginationHtml += createPaginationButton(currentPage + 1, '&raquo;');
    }
    dom.pagination.innerHTML = paginationHtml;

    // Event listener for pagination buttons
    document.querySelectorAll('.pagination-button').forEach(button => {
        button.addEventListener('click', (e) => {
            currentPage = parseInt(e.target.dataset.page, 10);
            renderProducts();
        });
    });
}

function createPaginationButton(page, text, isActive = false) {
    const activeClass = isActive ? 'active' : '';
    return `<button class="btn btn-outline-primary pagination-button ${activeClass}" data-page="${page}">${text}</button>`;
}

function resetFilters() {
    dom.searchInput.value = '';
    dom.categoryFilter.value = '';
    dom.priceFilter.value = '';
    dom.sortSelect.value = 'name';
    renderProducts();
}

// === Clear Data ===
function clearData() {
    if (dom.clearDataCodeInput.value === CLEAR_DATA_CODE) {
        localStorage.removeItem(STORAGE_CATEGORIES_KEY);
        localStorage.removeItem(STORAGE_DISCOUNTS_KEY);
        categories = [];
        discounts = {};
        saveCategories();
        bootstrap.Modal.getInstance(dom.clearDataModal).hide();
        showToast('База данных очищена.', 'green');
    } else {
        showToast('Неверный код подтверждения.', 'red');
    }
}

// === Simplified Data Saving ===
function saveCategories() {
    updateLocalStorage(STORAGE_CATEGORIES_KEY, categories);
    updateLocalStorage(STORAGE_DISCOUNTS_KEY, discounts); // Save discounts as well
    renderCategories();
    renderProducts();
    renderDiscountProductSelect();
    showToast('Данные успешно сохранены.', 'green');
}
dom.importDataButton.addEventListener('click', () => {
    dom.importFile.click();
});