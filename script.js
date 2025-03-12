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
let activeTable = tables[0] || null;
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
    searchSpinnerContainer: $('<div>').addClass('d-flex justify-content-center mt-2')
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
    dom.categoriesContainer.empty();

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
    const productsToDisplay = category.products.slice(startIndex, endIndex);

    dom.productsContainer.html(`<h3 class="text-center mb-3">Товары в категории: ${category.name}</h3><div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-3"></div>`);
    const row = dom.productsContainer.find('.row');

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

    if (activeTable && orders[activeTable]) {
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
    }

    dom.totalElement.text(formatCurrency(total));
}

// === Interaction Functions ===
function selectTable(table) {
    if (activeTable === table) return; // Не ререндерить, если тот же столик
    activeTable = table;
    saveData('activeTable', activeTable);
    renderTables();
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
    dom.exportReportButton.on('click', exportReportToCSV);

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
                paymentModal.hide(); // Закрываем модальное окно при ошибке
            });
    });
}

function processPayment(paymentMethod) {
    if (!paymentMethod) {
        alert('Ошибка: выберите способ оплаты.');
        return;
    }

    let totalText = dom.totalElement.text().replace(/[^\d.,]/g, '').replace(',', '.').trim();
    if (!totalText) {
        alert('Ошибка: сумма оплаты некорректна.');
        return;
    }

    const total = totalText ? parseFloat(totalText) : 0;
    if (isNaN(total) || total <= 0) {
        alert('Ошибка: сумма оплаты некорректна.');
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

    showPaymentSuccessModal();
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
    hideSearchLoadingSpinner();//Hide loading spinner
    isSearching = false;
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
            <p><strong>Оплат наличными:</strong> ${formatCurrency(totalCash)}</p>
            <p><strong>Оплат картой:</strong> ${formatCurrency(totalCard)}</p>
        </div>
    `;

    let catRevenueTable = `<div class="revenue-by-category"><p><strong>Выручка по категориям:</strong></p><table class="table">
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
    catRevenueTable += `</tbody></table></div>`
    reportHTML += catRevenueTable;

    reportHTML += `<p><strong>Общая выручка:</strong> ${formatCurrency(totalRevenue)}</p>`;

    dom.reportContainer.html(reportHTML);
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

function exportReportToCSV() {
    let payments = loadData('payments', []);
    if (!payments || payments.length === 0) {
        showToast('Нет данных для экспорта.', 'orange');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Столик,Дата,Способ оплаты,Сумма\r\n";

    payments.forEach(payment => {
        const row = [
            payment.table,
            new Date(payment.timestamp).toLocaleString(),
            payment.paymentMethod,
            formatCurrency(payment.total)
        ].join(",");
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sales_report.csv");
    document.body.appendChild(link); // Required for FF

    link.click();
    showToast('Отчет экспортирован в CSV!', 'green');
}

// === UI Improvements ===
function showSearchLoadingSpinner() {
    if(!isSearching){
        return;
    }
    dom.searchSpinnerContainer.addClass('d-flex justify-content-center mt-2');  // Add class to jQuery object.
    dom.searchSpinnerContainer.html('<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Загрузка...</span></div>');
    dom.productSection.prepend(dom.searchSpinnerContainer); //  Prepend jQuery object directly
}

function hideSearchLoadingSpinner() {
     dom.searchSpinnerContainer.remove(); //Use jQuery's .remove() to remove the element
}

function showSectionsBasedOnTableSelection() {
    dom.tableSelectionSection.toggle(activeTable === null);
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
    renderTables();
    renderCategories();
    setupEventListeners(); //Moved the setup after all the rendering is completed
    // Load products for the first category on initialization
    if (categories.length > 0) {
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