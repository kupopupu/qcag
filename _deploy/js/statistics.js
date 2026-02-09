/**
 * QCAG Statistics Module
 * Handles statistics modal with detailed reports and charts
 */

(function() {
  'use strict';

  // Statistics state
  const statsState = {
    activeTab: 'sales',
    statusType: 'qcag', // 'qcag' or 'spo'
    charts: {},
    initialized: false
  };

  // Initialize statistics module when DOM is ready
  function initStatistics() {
    if (statsState.initialized) return;
    statsState.initialized = true;

    // Setup event listeners
    setupEventListeners();
  }

  // Setup all event listeners
  function setupEventListeners() {
    // Tab switching
    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-stats-tab]');
      if (tabBtn) {
        const tab = tabBtn.dataset.statsTab;
        switchTab(tab);
      }

      // Status type toggle (QCAG vs SPO)
      const statusTypeBtn = e.target.closest('[data-status-type]');
      if (statusTypeBtn) {
        const type = statusTypeBtn.dataset.statusType;
        switchStatusType(type);
      }
    });

    // Modal open event
    const statsBtn = document.getElementById('statistic-btn');
    if (statsBtn) {
      statsBtn.addEventListener('click', () => {
        openStatisticsModal();
      });
    }
  }

  // Open statistics modal
  function openStatisticsModal() {
    const modal = document.getElementById('statistic-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    
    // Lock scroll on main page
    if (typeof ensureScrollLock === 'function') {
      ensureScrollLock();
    }
    
    // Force render the active tab on first open
    const currentTab = statsState.activeTab || 'sales';
    
    // Update tab buttons UI (same style as QC modal)
    document.querySelectorAll('[data-stats-tab]').forEach(btn => {
      if (btn.dataset.statsTab === currentTab) {
        btn.classList.add('bg-white', 'shadow', 'text-gray-800');
        btn.classList.remove('text-gray-600');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('bg-white', 'shadow', 'text-gray-800');
        btn.classList.add('text-gray-600');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    // Show active panel
    document.querySelectorAll('[data-stats-panel]').forEach(panel => {
      if (panel.dataset.statsPanel === currentTab) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Render content immediately
    renderTabContent(currentTab);
  }

  // Switch between tabs
  function switchTab(tab) {
    if (statsState.activeTab === tab) return;
    statsState.activeTab = tab;

    // Update tab buttons (same style as QC modal)
    document.querySelectorAll('[data-stats-tab]').forEach(btn => {
      if (btn.dataset.statsTab === tab) {
        btn.classList.add('bg-white', 'shadow', 'text-gray-800');
        btn.classList.remove('text-gray-600');
        btn.setAttribute('aria-selected', 'true');
      } else {
        btn.classList.remove('bg-white', 'shadow', 'text-gray-800');
        btn.classList.add('text-gray-600');
        btn.setAttribute('aria-selected', 'false');
      }
    });

    // Show active panel
    document.querySelectorAll('[data-stats-panel]').forEach(panel => {
      if (panel.dataset.statsPanel === tab) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // Render the active tab
    renderTabContent(tab);
  }

  // Switch status type (QCAG vs SPO)
  function switchStatusType(type) {
    if (statsState.statusType === type) return;
    statsState.statusType = type;

    // Update toggle buttons (same style as QC modal tabs)
    document.querySelectorAll('[data-status-type]').forEach(btn => {
      if (btn.dataset.statusType === type) {
        btn.classList.add('bg-white', 'shadow', 'text-gray-800');
        btn.classList.remove('text-gray-600');
      } else {
        btn.classList.remove('bg-white', 'shadow', 'text-gray-800');
        btn.classList.add('text-gray-600');
      }
    });

    // Re-render status stats
    renderStatusStats();
  }

  // Main render function
  function renderStatistics() {
    switchTab(statsState.activeTab);
  }

  // Render specific tab content
  function renderTabContent(tab) {
    switch (tab) {
      case 'sales':
        renderSalesStats();
        break;
      case 'status':
        renderStatusStats();
        break;
      case 'brand':
        renderBrandStats();
        break;
      case 'price':
        renderPriceStats();
        break;
      case 'quotes':
        renderQuotesStats();
        break;
    }
  }

  // ========== SALES STATISTICS ==========
  function renderSalesStats() {
    if (typeof currentQuotes === 'undefined' || !Array.isArray(currentQuotes)) {
      renderEmptyState('sales');
      return;
    }

    // Group by sale
    const salesData = {};
    let totalRevenue = 0;

    currentQuotes.forEach(quote => {
      const saleName = quote.sale_name || 'Chưa phân sale';
      if (!salesData[saleName]) {
        salesData[saleName] = {
          count: 0,
          revenue: 0,
          approved: 0,
          pending: 0,
          cancelled: 0
        };
      }

      salesData[saleName].count++;
      
      // Calculate revenue
      const revenue = parseFloat(quote.total_amount || 0);
      salesData[saleName].revenue += revenue;
      totalRevenue += revenue;

      // Count by status
      const status = String(quote.qcag_status || '').toLowerCase();
      if (status.includes('duyệt') || status.includes('đã ra đơn')) {
        salesData[saleName].approved++;
      } else if (status.includes('hủy')) {
        salesData[saleName].cancelled++;
      } else {
        salesData[saleName].pending++;
      }
    });

    // Sort by revenue
    const sortedSales = Object.entries(salesData)
      .sort((a, b) => b[1].revenue - a[1].revenue);

    // Render table
    const tableHtml = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sale</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Số BG</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Doanh thu</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Đã duyệt</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Chờ duyệt</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Đã hủy</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${sortedSales.map(([name, data]) => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(name)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${data.count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">${formatCurrency(data.revenue)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right">${data.approved}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-amber-600 text-right">${data.pending}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right">${data.cancelled}</td>
              </tr>
            `).join('')}
            <tr class="bg-blue-50 font-semibold">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TỔNG CỘNG</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${currentQuotes.length}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-700 text-right">${formatCurrency(totalRevenue)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-green-700 text-right">${sortedSales.reduce((sum, [, d]) => sum + d.approved, 0)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-amber-700 text-right">${sortedSales.reduce((sum, [, d]) => sum + d.pending, 0)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-red-700 text-right">${sortedSales.reduce((sum, [, d]) => sum + d.cancelled, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const container = document.getElementById('stats-sales-table');
    if (container) container.innerHTML = tableHtml;

    // Render chart
    renderSalesChart(sortedSales);
  }

  function renderSalesChart(salesData) {
    const canvas = document.getElementById('stats-sales-chart');
    if (!canvas) return;

    // Destroy existing chart
    if (statsState.charts.sales) {
      statsState.charts.sales.destroy();
    }

    const ctx = canvas.getContext('2d');
    const labels = salesData.map(([name]) => name);
    const revenues = salesData.map(([, data]) => data.revenue);
    const counts = salesData.map(([, data]) => data.count);

    statsState.charts.sales = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Doanh thu (VNĐ)',
            data: revenues,
            backgroundColor: 'rgba(59, 130, 246, 0.6)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            yAxisID: 'y'
          },
          {
            label: 'Số báo giá',
            data: counts,
            backgroundColor: 'rgba(16, 185, 129, 0.6)',
            borderColor: 'rgba(16, 185, 129, 1)',
            borderWidth: 1,
            type: 'line',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Doanh thu (VNĐ)'
            },
            ticks: {
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Số báo giá'
            },
            grid: {
              drawOnChartArea: false
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.dataset.yAxisID === 'y') {
                  label += formatCurrency(context.parsed.y);
                } else {
                  label += context.parsed.y;
                }
                return label;
              }
            }
          }
        }
      }
    });
  }

  // ========== STATUS STATISTICS ==========
  function renderStatusStats() {
    if (typeof currentQuotes === 'undefined' || !Array.isArray(currentQuotes)) {
      renderEmptyState('status');
      return;
    }

    // Determine which status field to use
    const statusField = statsState.statusType === 'spo' ? 'spo_status' : 'qcag_status';
    const statusLabel = statsState.statusType === 'spo' ? 'SPO' : 'QCAG';

    // Group by status
    const statusData = {};
    let totalRevenue = 0;

    currentQuotes.forEach(quote => {
      let status = quote[statusField] || 'Chưa xác định';
      
      // No classification for SPO status - show raw value
      // QCAG status is already stored as final value in database

      if (!statusData[status]) {
        statusData[status] = {
          count: 0,
          revenue: 0
        };
      }

      statusData[status].count++;
      const revenue = parseFloat(quote.total_amount || 0);
      statusData[status].revenue += revenue;
      totalRevenue += revenue;
    });

    // Sort by count
    const sortedStatus = Object.entries(statusData)
      .sort((a, b) => b[1].count - a[1].count);

    // Render table
    const tableHtml = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Trạng thái ${statusLabel}</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Số lượng</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tỷ lệ</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Doanh thu</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">% Doanh thu</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${sortedStatus.map(([status, data]) => {
              const percentage = ((data.count / currentQuotes.length) * 100).toFixed(1);
              const revenuePercentage = totalRevenue > 0 ? ((data.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
              return `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(status)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${data.count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${percentage}%</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">${formatCurrency(data.revenue)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${revenuePercentage}%</td>
              </tr>
            `}).join('')}
            <tr class="bg-blue-50 font-semibold">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TỔNG CỘNG</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${currentQuotes.length}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">100%</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-700 text-right">${formatCurrency(totalRevenue)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const container = document.getElementById('stats-status-table');
    if (container) container.innerHTML = tableHtml;

    // Render chart
    renderStatusChart(sortedStatus);
  }

  function renderStatusChart(statusData) {
    const canvas = document.getElementById('stats-status-chart');
    if (!canvas) return;

    if (statsState.charts.status) {
      statsState.charts.status.destroy();
    }

    const ctx = canvas.getContext('2d');
    const labels = statusData.map(([status]) => status);
    const counts = statusData.map(([, data]) => data.count);

    // Generate colors
    const colors = generateColors(labels.length);

    statsState.charts.status = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: colors.background,
          borderColor: colors.border,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  // ========== BRAND STATISTICS ==========
  function renderBrandStats() {
    if (typeof currentQuotes === 'undefined' || !Array.isArray(currentQuotes)) {
      renderEmptyState('brand');
      return;
    }

    // Group by brand
    const brandData = {};
    
    currentQuotes.forEach(quote => {
      try {
        const items = Array.isArray(quote.items) ? quote.items : JSON.parse(quote.items || '[]');
        items.forEach(item => {
          const brand = item.brand || 'Chưa có brand';
          if (!brandData[brand]) {
            brandData[brand] = {
              count: 0,
              quotes: new Set(),
              totalQuantity: 0
            };
          }
          brandData[brand].count++;
          brandData[brand].quotes.add(quote.quote_code);
          brandData[brand].totalQuantity += parseFloat(item.quantity || 0);
        });
      } catch (e) {
        // Ignore parse errors
      }
    });

    // Convert Set to count
    Object.keys(brandData).forEach(brand => {
      brandData[brand].quotesCount = brandData[brand].quotes.size;
      delete brandData[brand].quotes;
    });

    // Sort by item count
    const sortedBrands = Object.entries(brandData)
      .sort((a, b) => b[1].count - a[1].count);

    // Render table
    const tableHtml = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Brand</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Số items</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Số BG</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tổng SL</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${sortedBrands.map(([brand, data]) => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(brand)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${data.count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 text-right">${data.quotesCount}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${data.totalQuantity.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="bg-blue-50 font-semibold">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TỔNG CỘNG</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${sortedBrands.reduce((sum, [, d]) => sum + d.count, 0)}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">—</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">${sortedBrands.reduce((sum, [, d]) => sum + d.totalQuantity, 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;

    const container = document.getElementById('stats-brand-table');
    if (container) container.innerHTML = tableHtml;

    // Render chart (top 10)
    renderBrandChart(sortedBrands.slice(0, 10));
  }

  function renderBrandChart(brandData) {
    const canvas = document.getElementById('stats-brand-chart');
    if (!canvas) return;

    if (statsState.charts.brand) {
      statsState.charts.brand.destroy();
    }

    const ctx = canvas.getContext('2d');
    const labels = brandData.map(([brand]) => brand);
    const counts = brandData.map(([, data]) => data.count);

    statsState.charts.brand = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Số lượng items',
          data: counts,
          backgroundColor: 'rgba(139, 92, 246, 0.6)',
          borderColor: 'rgba(139, 92, 246, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Top 10 Brand'
          }
        },
        scales: {
          x: {
            beginAtZero: true
          }
        }
      }
    });
  }

  // ========== PRICE STATISTICS ==========
  function renderPriceStats() {
    if (typeof currentQuotes === 'undefined' || !Array.isArray(currentQuotes)) {
      renderEmptyState('price');
      return;
    }

    // Calculate price statistics
    const revenues = currentQuotes.map(q => parseFloat(q.total_amount || 0));
    const total = revenues.reduce((sum, val) => sum + val, 0);
    const average = revenues.length > 0 ? total / revenues.length : 0;
    const max = Math.max(...revenues, 0);
    const min = Math.min(...revenues.filter(v => v > 0), 0) || 0;

    // Price ranges
    const ranges = [
      { label: '< 5 triệu', min: 0, max: 5000000 },
      { label: '5-10 triệu', min: 5000000, max: 10000000 },
      { label: '10-20 triệu', min: 10000000, max: 20000000 },
      { label: '20-50 triệu', min: 20000000, max: 50000000 },
      { label: '50-100 triệu', min: 50000000, max: 100000000 },
      { label: '> 100 triệu', min: 100000000, max: Infinity }
    ];

    const rangeData = ranges.map(range => {
      const quotesInRange = currentQuotes.filter(q => {
        const amount = parseFloat(q.total_amount || 0);
        return amount >= range.min && amount < range.max;
      });
      const revenue = quotesInRange.reduce((sum, q) => sum + parseFloat(q.total_amount || 0), 0);
      return {
        label: range.label,
        count: quotesInRange.length,
        revenue: revenue,
        percentage: ((quotesInRange.length / currentQuotes.length) * 100).toFixed(1)
      };
    });

    // Render summary cards
    const summaryHtml = `
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div class="text-xs font-semibold text-blue-600 uppercase mb-2">Tổng doanh thu</div>
          <div class="text-2xl font-bold text-blue-900">${formatCurrency(total)}</div>
        </div>
        <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div class="text-xs font-semibold text-green-600 uppercase mb-2">Trung bình</div>
          <div class="text-2xl font-bold text-green-900">${formatCurrency(average)}</div>
        </div>
        <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div class="text-xs font-semibold text-purple-600 uppercase mb-2">Cao nhất</div>
          <div class="text-2xl font-bold text-purple-900">${formatCurrency(max)}</div>
        </div>
        <div class="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
          <div class="text-xs font-semibold text-amber-600 uppercase mb-2">Thấp nhất</div>
          <div class="text-2xl font-bold text-amber-900">${formatCurrency(min)}</div>
        </div>
      </div>
    `;

    // Render table
    const tableHtml = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Khoảng giá</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Số BG</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Tỷ lệ</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Doanh thu</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${rangeData.map(range => `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${escapeHtml(range.label)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${range.count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${range.percentage}%</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">${formatCurrency(range.revenue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const summaryContainer = document.getElementById('stats-price-summary');
    const tableContainer = document.getElementById('stats-price-table');
    if (summaryContainer) summaryContainer.innerHTML = summaryHtml;
    if (tableContainer) tableContainer.innerHTML = tableHtml;

    // Render chart
    renderPriceChart(rangeData);
  }

  function renderPriceChart(rangeData) {
    const canvas = document.getElementById('stats-price-chart');
    if (!canvas) return;

    if (statsState.charts.price) {
      statsState.charts.price.destroy();
    }

    const ctx = canvas.getContext('2d');
    const labels = rangeData.map(r => r.label);
    const counts = rangeData.map(r => r.count);

    statsState.charts.price = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Số lượng báo giá',
          data: counts,
          backgroundColor: 'rgba(245, 158, 11, 0.6)',
          borderColor: 'rgba(245, 158, 11, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: 'Phân bố theo khoảng giá'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  // ========== QUOTES STATISTICS ==========
  function renderQuotesStats() {
    if (typeof currentQuotes === 'undefined' || !Array.isArray(currentQuotes)) {
      renderEmptyState('quotes');
      return;
    }

    // Time-based analysis
    const today = new Date();
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const thisYear = new Date(today.getFullYear(), 0, 1);

    let todayCount = 0, thisMonthCount = 0, lastMonthCount = 0, thisYearCount = 0;
    let todayRevenue = 0, thisMonthRevenue = 0, lastMonthRevenue = 0, thisYearRevenue = 0;

    currentQuotes.forEach(quote => {
      const createdAt = new Date(quote.created_at);
      const revenue = parseFloat(quote.total_amount || 0);

      if (createdAt.toDateString() === today.toDateString()) {
        todayCount++;
        todayRevenue += revenue;
      }
      if (createdAt >= thisMonth) {
        thisMonthCount++;
        thisMonthRevenue += revenue;
      }
      if (createdAt >= lastMonth && createdAt < thisMonth) {
        lastMonthCount++;
        lastMonthRevenue += revenue;
      }
      if (createdAt >= thisYear) {
        thisYearCount++;
        thisYearRevenue += revenue;
      }
    });

    // Monthly breakdown for chart
    const monthlyData = {};
    currentQuotes.forEach(quote => {
      const date = new Date(quote.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, revenue: 0 };
      }
      monthlyData[monthKey].count++;
      monthlyData[monthKey].revenue += parseFloat(quote.total_amount || 0);
    });

    const sortedMonths = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0]));

    // Render summary
    const summaryHtml = `
      <div class="grid grid-cols-4 gap-4 mb-6">
        <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
          <div class="text-xs font-semibold text-blue-600 uppercase mb-2">Hôm nay</div>
          <div class="text-2xl font-bold text-blue-900">${todayCount} BG</div>
          <div class="text-sm text-blue-700 mt-1">${formatCurrency(todayRevenue)}</div>
        </div>
        <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
          <div class="text-xs font-semibold text-green-600 uppercase mb-2">Tháng này</div>
          <div class="text-2xl font-bold text-green-900">${thisMonthCount} BG</div>
          <div class="text-sm text-green-700 mt-1">${formatCurrency(thisMonthRevenue)}</div>
        </div>
        <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
          <div class="text-xs font-semibold text-purple-600 uppercase mb-2">Tháng trước</div>
          <div class="text-2xl font-bold text-purple-900">${lastMonthCount} BG</div>
          <div class="text-sm text-purple-700 mt-1">${formatCurrency(lastMonthRevenue)}</div>
        </div>
        <div class="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-6 border border-amber-200">
          <div class="text-xs font-semibold text-amber-600 uppercase mb-2">Năm nay</div>
          <div class="text-2xl font-bold text-amber-900">${thisYearCount} BG</div>
          <div class="text-sm text-amber-700 mt-1">${formatCurrency(thisYearRevenue)}</div>
        </div>
      </div>
    `;

    // Render monthly table
    const tableHtml = `
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tháng</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Số BG</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Doanh thu</th>
              <th class="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">TB/BG</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${sortedMonths.reverse().map(([month, data]) => {
              const avg = data.count > 0 ? data.revenue / data.count : 0;
              return `
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${month}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${data.count}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">${formatCurrency(data.revenue)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-right">${formatCurrency(avg)}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `;

    const summaryContainer = document.getElementById('stats-quotes-summary');
    const tableContainer = document.getElementById('stats-quotes-table');
    if (summaryContainer) summaryContainer.innerHTML = summaryHtml;
    if (tableContainer) tableContainer.innerHTML = tableHtml;

    // Render chart
    renderQuotesChart(sortedMonths.reverse());
  }

  function renderQuotesChart(monthlyData) {
    const canvas = document.getElementById('stats-quotes-chart');
    if (!canvas) return;

    if (statsState.charts.quotes) {
      statsState.charts.quotes.destroy();
    }

    const ctx = canvas.getContext('2d');
    const labels = monthlyData.map(([month]) => month);
    const counts = monthlyData.map(([, data]) => data.count);
    const revenues = monthlyData.map(([, data]) => data.revenue);

    statsState.charts.quotes = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Số báo giá',
            data: counts,
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            yAxisID: 'y'
          },
          {
            label: 'Doanh thu',
            data: revenues,
            borderColor: 'rgba(16, 185, 129, 1)',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Số báo giá'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Doanh thu (VNĐ)'
            },
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              callback: function(value) {
                return formatCurrency(value);
              }
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        }
      }
    });
  }

  // ========== UTILITY FUNCTIONS ==========
  function renderEmptyState(tab) {
    const containers = {
      sales: ['stats-sales-table'],
      status: ['stats-status-table'],
      brand: ['stats-brand-table'],
      price: ['stats-price-summary', 'stats-price-table'],
      quotes: ['stats-quotes-summary', 'stats-quotes-table']
    };

    const emptyHtml = '<div class="text-center text-gray-500 py-12">Chưa có dữ liệu</div>';
    
    (containers[tab] || []).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = emptyHtml;
    });
  }

  function formatCurrency(value) {
    if (typeof value !== 'number' || isNaN(value)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(value);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function generateColors(count) {
    const baseColors = [
      { bg: 'rgba(59, 130, 246, 0.6)', border: 'rgba(59, 130, 246, 1)' },      // blue
      { bg: 'rgba(16, 185, 129, 0.6)', border: 'rgba(16, 185, 129, 1)' },      // green
      { bg: 'rgba(245, 158, 11, 0.6)', border: 'rgba(245, 158, 11, 1)' },      // amber
      { bg: 'rgba(239, 68, 68, 0.6)', border: 'rgba(239, 68, 68, 1)' },        // red
      { bg: 'rgba(139, 92, 246, 0.6)', border: 'rgba(139, 92, 246, 1)' },      // purple
      { bg: 'rgba(236, 72, 153, 0.6)', border: 'rgba(236, 72, 153, 1)' },      // pink
      { bg: 'rgba(20, 184, 166, 0.6)', border: 'rgba(20, 184, 166, 1)' },      // teal
      { bg: 'rgba(251, 146, 60, 0.6)', border: 'rgba(251, 146, 60, 1)' }       // orange
    ];

    const background = [];
    const border = [];

    for (let i = 0; i < count; i++) {
      const color = baseColors[i % baseColors.length];
      background.push(color.bg);
      border.push(color.border);
    }

    return { background, border };
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStatistics);
  } else {
    initStatistics();
  }

  // Export for debugging
  window.QCAG_Statistics = {
    render: renderStatistics,
    switchTab: switchTab
  };

})();
