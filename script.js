// script.js
// === Utility Functions ===
function loadData(key, defaultValue) {
    try {
        const serializedData = localStorage.getItem(key);
        return serializedData ? JSON.parse(serializedData) : defaultValue;
    } catch (error) {
        console.error(`Error loading ${key} from localStorage:`, error);
        return defaultValue;
    }
}

function saveData(key, data) {
    try {
        const serializedData = JSON.stringify(data);
        localStorage.setItem(key, serializedData);
    } catch (error) {
        console.error(`Error saving ${key} to localStorage:`, error);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB'
    }).format(amount);
}

// === State ===
const categories = loadData('categories', []);
const orders = loadData('orders', {});
const tables = loadData('tables', [1, 2, 3, 4, 5]);
let activeTable = loadData('activeTable', null); // Load from localStorage
let currentActiveTableButton = null;
let discounts = loadData('discounts', {});
let isSearching = false;
let currentPage = 1; // start at page 1
const productsPerPage = 9;

// Report pagination
let reportCurrentPage = 1;
const ordersPerPage = 10; // Number of orders per page

// === DOM Elements ===
const dom = {
    tablesContainer: $('#tables'),
    categoriesContainer: $('#categories'),
    productsContainer: $('#products'),
    paginationContainer: $('#pagination'),
    cartElement: $('#cart'),
    totalElement: $('#total'),
    currentTableElement: $('#current-table'),
    loadingElement: $('#loading'),
    clearCartButton: $('#clear-cart-button'),
    payButton: $('#pay-button'),
    searchField: $('#search-field'),
    reportContainer: $('#report-container'),
    generateReportButton: $('#generate-report-button'),
    clearReportButton: $('#clear-report-button'),
    exportReportButton: $('#export-report-button'),
    reportPaginationContainer: $('#report-pagination'),
    tableSelectionSection: $('#table-selection'),
    cartSection: $('#cart-section'),
    productSection: $('#product-section'),
    categorySection: $('#category-section'),
    searchSpinnerContainer: $('<div>').addClass('d-flex justify-content-center mt-2'),
    tableSelectionTitle: $('#table-selection-title'), // Store the title element
    // changeTableButton: $('#change-table-button'), //  Кнопка выбора столика больше не нужна, удалена
};

// === Operation Queue ===
const operationQueue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || operationQueue.length === 0) return;
    isProcessing = true;

    const operation = operationQueue.shift();
    try {
        await operation();
    } catch (error) {
        console.error('Error processing queue:', error);
    } finally {
        isProcessing = false;
        processQueue();
    }
}

// === Rendering Functions ===
function renderTables() {
    dom.tablesContainer.empty();
    // Добавлена подсказка, если столики не загружены
    if (tables.length === 0) {
        dom.tablesContainer.append('<p class="text-muted">Нет доступных столиков.  Пожалуйста, добавьте столики в админке.</p>');
        return;
    }

    tables.forEach(table => {
        const button = $('<button>')
            .addClass(`table-btn ${orders[table] && orders[table].length > 0 ? 'occupied-table' : ''} ${activeTable === table ? 'active-table' : ''}`)
            .text(`Столик ${table}`)
            .data('tableId', table)
            .on('click', () => selectTable(table));
        dom.tablesContainer.append(button);
    });
}

function renderCategories() {
    //  Убедитесь, что здесь не очищается dom.tablesContainer
    dom.categoriesContainer.empty();

    // Добавлена подсказка, если категории не загружены
    if (categories.length === 0) {
        dom.categoriesContainer.append('<p class="text-muted">Нет доступных категорий.  Пожалуйста, добавьте категории в админке.</p>');
        return;
    }

    categories.forEach((category, index) => {
        const div = $('<div>')
            .addClass('category')
            .text(category.name)
            .data('categoryIndex', index)
            .on('click', () => {
                currentPage = 1;  // Reset to page 1 when a new category is selected
                renderProductsByCategory(index);
            });
        dom.categoriesContainer.append(div);
    });

    if (dom.categoriesContainer.hasClass('slick-initialized')) {
        dom.categoriesContainer.slick('unslick'); // Убираем старый слайдер перед созданием нового
    }

    dom.categoriesContainer.slick({
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

function renderProductsByCategory(categoryIndex) {
    const category = categories[categoryIndex];
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    let productsToDisplay;

    if (isSearching) {
        // If searching, productsToDisplay will be set in searchProducts()
        productsToDisplay = []; // Or load from a separate search results array if you have one
    } else {
        productsToDisplay = category.products.slice(startIndex, endIndex);
    }

    dom.productsContainer.html(`<h3 class="text-center mb-3">Товары в категории: ${category.name}</h3><div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3"></div>`);
    const row = dom.productsContainer.find('.row');

    // Добавлена подсказка, если в категории нет товаров
    if (productsToDisplay.length === 0) {
        dom.productsContainer.append('<p class="text-muted">В этой категории нет товаров.</p>');
        return;
    }

    productsToDisplay.forEach(product => {
        const div = $('<div>').addClass('col');
        const button = $('<button>')
            .addClass('btn btn-sm btn-outline-secondary add-to-cart-btn')
            .data('product', product) // Store the object directly in jQuery data
            .data('cat-index', categoryIndex)
            .data('prod-index', category.products.indexOf(product))
            .html('<i class="fas fa-plus"></i> Добавить');

        const cardBody = $('<div>').addClass('card-body').html(`
            <p class="card-text product-name">${product.name}</p>
            <div class="d-flex justify-content-between align-items-center">
                <div class="input-group">
                    <input type="number" class="form-control product-quantity" value="1" min="1" aria-label="Количество">
                </div>
                <small class="text-muted">${formatCurrency(product.price)}</small>
            </div>
        `);

        cardBody.find('.input-group').append(button); // Append the button after the input

        div.html($('<div>').addClass('card shadow-sm product-card').html(cardBody));
        row.append(div);
    });

    renderPagination(category.products.length, categoryIndex);
}

function renderPagination(totalProducts, categoryIndex) {
    const totalPages = Math.ceil(totalProducts / productsPerPage);
    dom.paginationContainer.empty();

    if (totalPages > 1) {
        const ul = $('<ul>').addClass('pagination');

        // Previous Page Link
        const prevLi = $('<li>').addClass(`page-item ${currentPage === 1 ? 'disabled' : ''}`);
        const prevA = $('<a>').addClass('page-link').attr('href', '#').text('Назад').on('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                renderProductsByCategory(categoryIndex);
            }
        });
        prevLi.append(prevA);
        ul.append(prevLi);

        // Page Number Links
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = $('<li>').addClass(`page-item ${currentPage === i ? 'active' : ''}`);
            const pageA = $('<a>').addClass('page-link').attr('href', '#').text(i).on('click', (e) => {
                e.preventDefault();
                currentPage = i;
                renderProductsByCategory(categoryIndex);
            });
            pageLi.append(pageA);
            ul.append(pageLi);
        }

        // Next Page Link

        const nextLi = $('<li>').addClass(`page-item ${currentPage === totalPages ? 'disabled' : ''}`);
        const nextA = $('<a>').addClass('page-link').attr('href', '#').text('Вперед').on('click', (e) => {
            e.preventDefault();
            if (currentPage < totalPages) {
                currentPage++;
                renderProductsByCategory(categoryIndex);
            }
        });
        nextLi.append(nextA);
        ul.append(nextLi);

        dom.paginationContainer.append(ul);
    }
}

function renderCart() {
    dom.cartElement.empty();
    let total = 0;

    // Добавлена подсказка, если корзина пуста
    if (!activeTable || !orders[activeTable] || orders[activeTable].length === 0) {
        dom.cartElement.append('<p class="text-muted">Корзина пуста.</p>');
        dom.totalElement.text(formatCurrency(0));
        return;
    }

    orders[activeTable].forEach((item, index) => {
        const itemDiscount = discounts[item.catIndex] && discounts[item.catIndex][item.prodIndex] ? discounts[item.catIndex][item.prodIndex] : 0;
        let discountedPrice = item.price - itemDiscount;
        discountedPrice = discountedPrice < 0 ? 0 : discountedPrice

        const itemTotal = discountedPrice * item.quantity;
        total += itemTotal;

        const li = $('<li>').addClass('list-group-item d-flex justify-content-between align-items-center').html(`
            <div>
                ${item.name} - ${formatCurrency(item.price)} x ${item.quantity}
                ${itemDiscount > 0 ? `<span class="text-success"> (скидка: ${formatCurrency(itemDiscount)} за шт.)</span>` : ''}
            </div>
            <div class="quantity-controls">
                <button class="btn btn-sm btn-secondary decrease-quantity" data-index="${index}" aria-label="Уменьшить количество"><i class="fas fa-minus"></i></button>
                <input type="number" class="form-control cart-quantity-input" value="${item.quantity}" min="1" data-index="${index}" aria-label="Количество">
                <button class="btn btn-sm btn-secondary increase-quantity" data-index="${index}" aria-label="Увеличить количество"><i class="fas fa-plus"></i></button>
                <button class="btn btn-danger btn-sm remove-from-cart" data-index="${index}" aria-label="Удалить из корзины"><i class="fas fa-trash"></i></button>
            </div>
        `);
        dom.cartElement.append(li);
    });

    dom.totalElement.text(formatCurrency(total));
}

// === Interaction Functions ===
function selectTable(table) {
    if (activeTable === table) return; // Не ререндерить, если тот же столик
    activeTable = table;
    saveData('activeTable', activeTable);
    renderTables(); //  Перемещено сюда
    dom.currentTableElement.text(`Столик ${table}`);
    renderCart();
    showSectionsBasedOnTableSelection();
}

function addToCart(product, catIndex, prodIndex, quantity) {
    if (!activeTable) {
        alert('Пожалуйста, выберите столик.');
        return;
    }

    if (!orders[activeTable] || !Array.isArray(orders[activeTable])) {
        orders[activeTable] = [];
    }

    const existingProductIndex = orders[activeTable].findIndex(item => item.name === product.name && item.price === product.price && item.catIndex === catIndex && item.prodIndex === prodIndex);
    if (existingProductIndex !== -1) {
        orders[activeTable][existingProductIndex].quantity += quantity;
        showToast(`${product.name} x ${quantity} добавлен(ы) (увеличено количество) в корзину!`, 'green');
    } else {
        orders[activeTable].push({
            ...product,
            catIndex,
            prodIndex,
            quantity: quantity
        });
         showToast(`${product.name} x ${quantity} добавлен(ы) в корзину!`, 'green');
    }

    saveData('orders', orders);
    renderCart();
    renderTables();
}

function changeQuantity(index, amount) {
    if (!activeTable || !orders[activeTable]) {
        return;
    }

    const item = orders[activeTable][index];
    item.quantity = Math.max(1, item.quantity + amount); // Prevent quantity from going below 1
    saveData('orders', orders);
    renderCart();
}

function updateQuantity(index, newQuantity) {
    if (!activeTable || !orders[activeTable]) {
        return;
    }

    const parsedQuantity = parseInt(newQuantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
        orders[activeTable][index].quantity = 1; // Если введено некорректное значение, сбрасываем на 1
        showToast('Некорректное количество. Установлено минимальное значение (1).', 'orange');
    } else {
        orders[activeTable][index].quantity = parsedQuantity;
    }

    saveData('orders', orders);
    renderCart();
}

function setupEventListeners() {
    dom.cartElement.on('click', '.increase-quantity', function() {
        const index = parseInt($(this).data('index'));
        changeQuantity(index, 1);
    });

    dom.cartElement.on('click', '.decrease-quantity', function() {
        const index = parseInt($(this).data('index'));
        changeQuantity(index, -1);
    });

    dom.cartElement.on('click', '.remove-from-cart', function() {
        const index = parseInt($(this).data('index'));
        removeFromCart(index);
    });

    dom.cartElement.on('change', '.cart-quantity-input', function() {
        const index = parseInt($(this).data('index'));
        const newQuantity = $(this).val();
        updateQuantity(index, newQuantity);
    });

    dom.clearCartButton.on('click', clearCart);
    dom.payButton.on('click', showPaymentModal);
    dom.searchField.on('input', searchProducts);
    dom.generateReportButton.on('click', generateReport);
    dom.clearReportButton.on('click', clearReports);
    dom.exportReportButton.on('click', exportReportToWord);

    dom.productsContainer.on('click', '.add-to-cart-btn', function() {
        const product = $(this).data('product'); // Access the stored product object directly
        const catIndex = parseInt($(this).data('cat-index'));
        const prodIndex = parseInt($(this).data('prod-index'));
        const quantityInput = $(this).closest('.card-body').find('.product-quantity');
        const quantity = parseInt(quantityInput.val());
        if (isNaN(quantity) || quantity < 1) {
            alert('Пожалуйста, введите корректное количество.');
            return;
        }
        addToCart(product, catIndex, prodIndex, quantity);
    });
}

function removeFromCart(index) {
    operationQueue.push(async () => {
        return new Promise((resolve) => {
            if (!activeTable || !orders[activeTable] || !orders[activeTable].length) {
                resolve();
                return;
            }

            const productName = orders[activeTable][index].name;
            orders[activeTable].splice(index, 1);
            if (orders[activeTable].length === 0) {
                delete orders[activeTable]; // Очищаем корзину
                showToast(`Товар "${productName}" удален из корзины. Корзина пуста.`, 'red');
            } else {
                showToast(`Товар "${productName}" удален из корзины.`, 'red');
            }
            saveData('orders', orders);
            renderCart();
            resolve();
        });
    });
    processQueue();
}

function clearCart() {
    operationQueue.push(async () => {
        return new Promise((resolve) => {
            if (!activeTable || !orders[activeTable]) {
                resolve();
                return;
            }

            delete orders[activeTable]; // Очищаем корзину
            saveData('orders', orders);
            renderCart();
            renderTables();
            showToast('Корзина очищена!', 'red');
            resolve();
        });
    });
    processQueue();
}

// === Payment Logic ===
function showPaymentModal() {
    if (!activeTable) {
        alert('Пожалуйста, выберите столик.');
        return;
    }

    if (!orders[activeTable] || orders[activeTable].length === 0) {
        alert('Корзина пуста. Добавьте товары перед оплатой.');
        return;
    }

    const paymentModal = new bootstrap.Modal($('#paymentModal')[0]);
    paymentModal.show();

    $('#confirmPayment').one('click', () => {
        const paymentMethod = $('input[name="paymentMethod"]:checked').val();
        processPayment(paymentMethod)
            .then(() => {
                paymentModal.hide(); // Закрываем модальное окно после оплаты
                showPaymentSuccessModal(); // Показать модальное окно об успехе
            })
            .catch(error => {
                console.error('Payment process failed:', error);
                alert(error); // Отображаем сообщение об ошибке пользователю
                paymentModal.hide(); // Закрываем модальное окно при ошибке
            });
    });
}

function processPayment(paymentMethod) {
    return new Promise((resolve, reject) => {  // Обернули в Promise
        if (!paymentMethod) {
            reject('Ошибка: выберите способ оплаты.');
            return;
        }

        let totalText = dom.totalElement.text().replace(/[^\d.,]/g, '').replace(',', '.').trim();
        if (!totalText) {
            reject('Ошибка: сумма оплаты некорректна.');
            return;
        }

        const total = totalText ? parseFloat(totalText) : 0;
        if (isNaN(total) || total <= 0) {
            reject('Ошибка: сумма оплаты некорректна.');
            return;
        }

        const paymentData = {
            table: activeTable,
            total,
            paymentMethod,
            timestamp: new Date().toISOString(),
            items: orders[activeTable] ? [...orders[activeTable]] : []
        };

        savePaymentData(paymentData);

        // Clear the cart *after* saving the payment data.
        clearCart();
        // Clear Orders as well
        delete orders[activeTable]; // Corrected line
        saveData('orders', orders);

        resolve(); // Успешное выполнение
    });
}

function savePaymentData(paymentData) {
    let payments = loadData('payments', []);
    payments.push(paymentData);
    saveData('payments', payments);
}

function showPaymentSuccessModal() {
    const paymentSuccessModal = new bootstrap.Modal($('#paymentSuccessModal')[0]);
    paymentSuccessModal.show();
}

//Reports
function clearReports() {
    localStorage.removeItem('payments');
    dom.reportContainer.html('<p>Нет данных для отчета.</p>');
    showToast('Отчеты очищены!', 'red');
}

function searchProducts() {
    const searchTerm = dom.searchField.val().toLowerCase();
    if (searchTerm.length < 2) { // Require at least 2 characters for meaningful search
         dom.productsContainer.empty().html('<p class="text-center">Введите минимум 2 символа для поиска.</p>');
         return;
     }

    isSearching = true;
    showSearchLoadingSpinner(); // Show loading spinner

    let allProducts = [];
    categories.forEach((category, catIndex) => {
        category.products.forEach((product, prodIndex) => {
            allProducts.push({ ...product, catIndex, prodIndex, categoryName: category.name });
        });
    });

    // Improved search using includes on multiple fields
    const filteredProducts = allProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm) ||
        product.categoryName.toLowerCase().includes(searchTerm) //Search category as well
    );

    // Render the filtered products
    renderSearchResults(filteredProducts);
    hideSearchLoadingSpinner();//Hide loading spinner
    isSearching = false;
}

function renderSearchResults(filteredProducts) {
    dom.productsContainer.empty();
    if (filteredProducts.length > 0) {
        dom.productsContainer.html(`<h3 class="text-center mb-3">Результаты поиска</h3><div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3"></div>`);
        const row = dom.productsContainer.find('.row');

        filteredProducts.forEach(product => {
            const div = $('<div>').addClass('col');
            const button = $('<button>')
                .addClass('btn btn-sm btn-outline-secondary add-to-cart-btn')
                .data('product', product) // Store the object directly in jQuery data
                .data('cat-index', product.catIndex)
                .data('prod-index', product.prodIndex)
                .html('<i class="fas fa-plus"></i> В корзину');

            const cardBody = $('<div>').addClass('card-body').html(`
                <p class="card-text product-name">${product.name} (${product.categoryName})</p>
                <div class="d-flex justify-content-between align-items-center">
                    <div class="input-group">
                        <input type="number" class="form-control product-quantity" value="1" min="1" aria-label="Количество">
                    </div>
                    <small class="text-muted">${formatCurrency(product.price)}</small>
                </div>
            `);

            cardBody.find('.input-group').append(button); // Append the button after the input

            div.html($('<div>').addClass('card shadow-sm product-card').html(cardBody));
            row.append(div);
        });
    } else {
        dom.productsContainer.html('<p class="text-center">Ничего не найдено.</p>');
    }
}


function generateReport() {
    let payments = loadData('payments', []);
    if (!payments || payments.length === 0) {
        dom.reportContainer.html('<p>Нет данных для отчета.</p>');
        showToast('Нет данных для отчета.', 'orange');
        return;
    }

    reportCurrentPage = 1;
    renderReportPage(payments, reportCurrentPage);
    renderReportPagination(payments, payments.length); // Pass the number of payments
    showToast('Отчет сгенерирован!', 'green');
}

function renderReportPage(payments, page) {
    const startIndex = (page - 1) * ordersPerPage;
    const endIndex = startIndex + ordersPerPage;
    const ordersToDisplay = payments.slice(startIndex, endIndex);

    let reportHTML = '';
    let totalCash = 0;
    let totalCard = 0;
    let categoryRevenue = {};
    let totalRevenue = 0;

    ordersToDisplay.forEach(payment => {
        let orderItemsHTML = '';
        if (payment.items && payment.items.length > 0) {
            orderItemsHTML = '<ul class="list-unstyled">';
            payment.items.forEach(item => {
                orderItemsHTML += `<li>${item.name} x ${item.quantity} - ${formatCurrency(item.price * item.quantity)}</li>`;
            });
            orderItemsHTML += '</ul>';
        } else {
            orderItemsHTML = '<p>Нет товаров в заказе.</p>';
        }

        reportHTML += `
          <div class="card mb-3">
              <div class="card-body">
                  <h5 class="card-title">Столик ${payment.table}</h5>
                  <p class="card-text"><strong>Дата:</strong> ${new Date(payment.timestamp).toLocaleString()}</p>
                  <p class="card-text"><strong>Способ оплаты:</strong> ${payment.paymentMethod}</p>
                  <p class="card-text"><strong>Сумма:</strong> ${formatCurrency(payment.total)}</p>
                  <p class="card-text"><strong>Заказанные товары:</strong></p>
                  ${orderItemsHTML}
              </div>
          </div>`;
        if (payment.paymentMethod === 'cash') {
            totalCash += payment.total;
        } else if (payment.paymentMethod === 'card') {
            totalCard += payment.total;
        }
        totalRevenue += payment.total;
    });

    // Summary of payment methods
    reportHTML += `
        <div class="payment-summary mt-3">
            <h5>Итоги по способам оплаты</h5>
            <p><strong>Оплат наличными:</strong> ${formatCurrency(totalCash)}</p>
            <p><strong>Оплат картой:</strong> ${formatCurrency(totalCard)}</p>
        </div>
    `;

    let catRevenueTable = `<div class="revenue-by-category mt-3"><p><strong>Выручка по категориям:</strong></p><table class="table">
        <thead>
            <tr>
                <th>Категория</th>
                <th>Выручка</th>
            </tr>
        </thead>
        <tbody>`;
    let totalCatRevenue = 0;
    ordersToDisplay.forEach(payment => {
        if(payment.items && payment.items.length > 0){
            payment.items.forEach(item => {
                const itemTotal = item.price * item.quantity;
                if (!categoryRevenue[item.catIndex]) {
                    categoryRevenue[item.catIndex] = 0;
                }
                categoryRevenue[item.catIndex] += itemTotal;
            });
        }
    });
    for (const catIndex in categoryRevenue) {
        const categoryName = categories[catIndex].name;
        const revenue = categoryRevenue[catIndex];
        totalCatRevenue += revenue;
        catRevenueTable += `<tr><td>${categoryName}</td><td>${formatCurrency(revenue)}</td></tr>`;
    }
    catRevenueTable += `</tbody></table></div>`;
    reportHTML += catRevenueTable;

    reportHTML += `<div class="total-revenue mt-3"><p><strong>Общая выручка:</strong> ${formatCurrency(totalRevenue)}</p></div>`;

    dom.reportContainer.html(reportHTML);
}

function exportReportToWord() {
    const reportElement = document.getElementById('report-container');

    if (!reportElement || !reportElement.innerHTML.trim()) {
        showToast('Нет данных для экспорта.', 'orange');
        return;
    }

    const reportTitle = reportElement.querySelector('h2')?.textContent || 'Отчет о продажах';

    let plainTextContent = `**${reportTitle}**\n\n`;

    const sections = reportElement.querySelectorAll('.card, .payment-summary, .revenue-by-category, .total-revenue');

    sections.forEach(section => {
        const titleElements = section.querySelectorAll('h5, p');
        let title = '';

        titleElements.forEach(el => {
            if (el.tagName === 'H5' || (el.tagName === 'P' && el.querySelector('strong'))) {
                title += el.textContent + ' ';
            }
        });
        title = title.trim();


        if (title) {
            plainTextContent += `**${title}**\n\n`;
        }

        const paragraphs = section.querySelectorAll('p');

        paragraphs.forEach(paragraph => {
            plainTextContent += `${paragraph.textContent}\n`;
        });

        plainTextContent += '\n\n';
    });

    const blob = new Blob([plainTextContent], { type: 'application/msword' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/ /g, '_')}.doc`;

    // Центрирование ссылки на скачивание
    document.body.appendChild(a);
    a.style.display = 'block';
    a.style.margin = '0 auto'; // Это центрирует элемент по горизонтали
    a.style.textAlign = 'center'; // Это выравнивает текст внутри элемента по центру (необязательно, но может быть полезно)
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Отчет "**${reportTitle}**" экспортирован в Word!`, 'green', 3000);
}

function renderReportPagination(payments, totalPayments) {
    const totalPages = Math.ceil(totalPayments / ordersPerPage);
    dom.reportPaginationContainer.empty();

    if (totalPages > 1) {
        const ul = $('<ul>').addClass('pagination');

        // Previous Page Link
        const prevLi = $('<li>').addClass(`page-item ${reportCurrentPage === 1 ? 'disabled' : ''}`);
        const prevA = $('<a>').addClass('page-link').attr('href', '#').text('Назад').on('click', (e) => {
            e.preventDefault();
            if (reportCurrentPage > 1) {
                reportCurrentPage--;
                renderReportPage(payments, reportCurrentPage);
                renderReportPagination(payments, totalPayments);
            }
        });
        prevLi.append(prevA);
        ul.append(prevLi);

        // Page Number Links
        for (let i = 1; i <= totalPages; i++) {
            const pageLi = $('<li>').addClass(`page-item ${reportCurrentPage === i ? 'active' : ''}`);
            const pageA = $('<a>').addClass('page-link').attr('href', '#').text(i).on('click', (e) => {
                e.preventDefault();
                reportCurrentPage = i;
                renderReportPage(payments, reportCurrentPage);
                renderReportPagination(payments, totalPayments);
            })
            pageLi.append(pageA);
            ul.append(pageLi);
        }

        // Next Page Link
        const nextLi = $('<li>').addClass(`page-item ${reportCurrentPage === totalPages ? 'disabled' : ''}`);
        const nextA = $('<a>').addClass('page-link').attr('href', '#').text('Вперед').on('click', (e) => {
            e.preventDefault();
            if (reportCurrentPage < totalPages) {
                reportCurrentPage++;
                renderReportPage(payments, reportCurrentPage);
                renderReportPagination(payments, totalPayments);
            }
        });
        nextLi.append(nextA);
        ul.append(nextLi);

        dom.reportPaginationContainer.append(ul);
    }
}

function exportReportToWord() {
    const reportElement = document.getElementById('report-container');

    if (!reportElement || !reportElement.innerHTML.trim()) {
        showToast('Нет данных для экспорта.', 'orange');
        return;
    }

    const reportTitle = reportElement.querySelector('h2')?.textContent.trim() || 'Отчет о продажах';

    let htmlContent = `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>${reportTitle}</title>
    <style>
      body {
        font-style: normal;
        font-family: 'Roboto', sans-serif;
      }
      h2 {
        font-family: 'Roboto', sans-serif;
        font-size: 1.5em;
        font-weight: normal;
        margin-bottom: 0.5em;
      }
      h5 {
      font-family: 'Roboto', sans-serif;
        font-size: 1.1em;
        font-weight: normal;
        margin-bottom: 0.3em;
      }
      p {
      font-family: 'Roboto', sans-serif;
        margin-bottom: 0.3em;
        font-weight: normal;
      }
      .card {
          margin-bottom: 2em;  /* Увеличенное расстояние между блоками card */
          border: 1px solid #ccc;
          padding: 0.5em;
      }
      .payment-summary { margin-top: 1em; margin-bottom: 2em; }  /*Увеличенный отступ*/
      .revenue-by-category { margin-bottom: 2em; } /*Увеличенный отступ*/
      .revenue-by-category table { width: 100%; border-collapse: collapse; }
      .revenue-by-category th, .revenue-by-category td { border: 1px solid #ccc; padding: 0.3em; text-align: left; }
      .revenue-by-category th { background-color: #f0f0f0; }
      .total-revenue { margin-top: 1em; }
    </style>
    </head>
    <body>
      <h2>${reportTitle}</h2>`;

    const sections = reportElement.querySelectorAll('.card, .payment-summary, .revenue-by-category, .total-revenue');

    sections.forEach(section => {
        if (section.classList.contains('card')) {
            const title = section.querySelector('h5')?.textContent.trim() || '';
            htmlContent += `<div class="card"><h5>${title}</h5>`; // Используем card

            const paragraphs = section.querySelectorAll('p');
            paragraphs.forEach(paragraph => {
                htmlContent += `<p>${paragraph.textContent.trim()}</p>`;
            });

            htmlContent += `</div>`;
        } else if (section.classList.contains('payment-summary')) {
            const title = section.querySelector('h5')?.textContent.trim() || 'Итоги по способам оплаты';
            htmlContent += `<div class="payment-summary"><h5>${title}</h5>`;
            const paragraphs = section.querySelectorAll('p');
            paragraphs.forEach(paragraph => {
                htmlContent += `<p>${paragraph.textContent.trim()}</p>`;
            });
            htmlContent += `</div>`;

        } else if (section.classList.contains('revenue-by-category')) {
             const title = section.querySelector('h5')?.textContent.trim() || 'Выручка по категориям';
             htmlContent += `<div class="revenue-by-category"><h5>${title}</h5>`;
             htmlContent += '<table>';
             const headers = section.querySelectorAll('th');
             if (headers.length > 0) {
                 htmlContent += '<thead><tr>';
                 headers.forEach(header => {
                     htmlContent += `<th>${header.textContent.trim()}</th>`;
                 });
                 htmlContent += '</tr></thead>';
             }

             const rows = section.querySelectorAll('tr');
             rows.forEach((row, index) => {
                 if (index === 0 && headers.length > 0) return;  // Пропускаем заголовок, если он уже обработан
                 const cells = row.querySelectorAll('td');
                 if (cells.length > 0) {
                     htmlContent += '<tr>';
                     cells.forEach(cell => {
                         htmlContent += `<td>${cell.textContent.trim()}</td>`;
                     });
                     htmlContent += '</tr>';
                 }
             });

             htmlContent += '</table></div>';
         } else if (section.classList.contains('total-revenue')){
            htmlContent += `<div class="total-revenue">`;
            const paragraphs = section.querySelectorAll('p');
            paragraphs.forEach(paragraph => {
                htmlContent += `<p>${paragraph.textContent.trim()}</p>`;
            });
             htmlContent += `</div>`;
         }
    });

    htmlContent += `</body></html>`;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });  // Важно: \ufeff - BOM

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.replace(/ /g, '_')}.doc`;

    document.body.appendChild(a);
    a.style.display = 'block';
    a.style.margin = '0 auto';
    a.style.textAlign = 'center';
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Отчет "**${reportTitle}**" экспортирован в Word!`, 'green', 3000);
}
function hideSearchLoadingSpinner() {
     dom.searchSpinnerContainer.remove(); //Use jQuery's .remove() to remove the element
}

function showSectionsBasedOnTableSelection() {
    dom.tableSelectionSection.show(); // Отображать всегда
    dom.productSection.toggle(activeTable !== null);
    dom.cartSection.toggle(activeTable !== null);
}

function showToast(message, color) {
    Toastify({
        text: message,
        duration: 3000, // 3 seconds
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "right", // `left`, `center` or `right`
        backgroundColor: color, //"linear-gradient(to right, #00b09b, #96c93d)",
        stopOnFocus: true, // Prevents dismissing of toast on hover
    }).showToast();
}

// === Initialization ===
function initialize() {
    //Added css to center the categories title
    const styleSheet = $("<style>").html(".category { justify-content: center; }");
    $('head').append(styleSheet);

    // Set active table if it was saved in localStorage
    if (activeTable) {
        dom.currentTableElement.text(`Столик ${activeTable}`);
        showSectionsBasedOnTableSelection(); // Show sections based on the active table
    }

    renderTables(); //  Вызов renderTables() всегда
    renderCategories();
    setupEventListeners(); //Moved the setup after all the rendering is completed

    // Load products for the first category on initialization
    if (categories.length > 0 && !activeTable) {
        renderProductsByCategory(0);
    }

    showSectionsBasedOnTableSelection();
    dom.loadingElement.hide();

    //Add a delay here to make sure that all the actions are completed
    setTimeout(() => {
        // This will run after a tiny delay
    }, 10);
}

$(document).ready(initialize);