(function() {
  'use strict';

  const container = document.getElementById('cc-jobs-widget');
  if (!container) {
    console.error('Community Canvas Jobs Widget: Container element #cc-jobs-widget not found');
    return;
  }

  const embedKey = container.dataset.embedKey;
  if (!embedKey) {
    console.error('Community Canvas Jobs Widget: data-embed-key attribute is required');
    return;
  }

  const apiBase = container.dataset.apiBase || (document.currentScript && new URL(document.currentScript.src).origin) || '';
  const limit = parseInt(container.dataset.limit) || 10;
  const showLogo = container.dataset.showLogo !== 'false';

  const styles = `
    .cc-jobs-widget {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      color: #1a1a1a;
      max-width: 100%;
    }
    .cc-jobs-widget * {
      box-sizing: border-box;
    }
    .cc-jobs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e5e5e5;
    }
    .cc-jobs-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }
    .cc-jobs-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .cc-job-card {
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 1rem;
      background: #fff;
      transition: box-shadow 0.2s, border-color 0.2s;
    }
    .cc-job-card:hover {
      border-color: #d1d1d1;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .cc-job-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.5rem 0;
      color: #1a1a1a;
    }
    .cc-job-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      font-size: 0.875rem;
      color: #666;
    }
    .cc-job-tag {
      background: #f5f5f5;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
    }
    .cc-job-location {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }
    .cc-job-pay {
      color: #059669;
      font-weight: 500;
    }
    .cc-jobs-empty {
      text-align: center;
      padding: 2rem;
      color: #666;
    }
    .cc-jobs-error {
      text-align: center;
      padding: 2rem;
      color: #dc2626;
      background: #fef2f2;
      border-radius: 8px;
    }
    .cc-jobs-loading {
      text-align: center;
      padding: 2rem;
      color: #666;
    }
    .cc-jobs-footer {
      margin-top: 1rem;
      text-align: center;
      font-size: 0.75rem;
      color: #999;
    }
    .cc-jobs-footer a {
      color: #666;
      text-decoration: none;
    }
    .cc-jobs-footer a:hover {
      text-decoration: underline;
    }
    @media (prefers-color-scheme: dark) {
      .cc-jobs-widget {
        color: #e5e5e5;
      }
      .cc-jobs-header {
        border-bottom-color: #333;
      }
      .cc-job-card {
        background: #1a1a1a;
        border-color: #333;
      }
      .cc-job-card:hover {
        border-color: #444;
      }
      .cc-job-title {
        color: #e5e5e5;
      }
      .cc-job-meta {
        color: #999;
      }
      .cc-job-tag {
        background: #333;
      }
    }
  `;

  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  container.appendChild(styleEl);

  const widget = document.createElement('div');
  widget.className = 'cc-jobs-widget';
  widget.innerHTML = '<div class="cc-jobs-loading">Loading jobs...</div>';
  container.appendChild(widget);

  function formatPay(job) {
    if (!job.showPay || (!job.payMin && !job.payMax)) return null;
    const unit = job.pay_type === 'hourly' ? '/hr' : '/yr';
    if (job.payMin && job.payMax) {
      return '$' + job.payMin.toLocaleString() + ' - $' + job.payMax.toLocaleString() + unit;
    }
    if (job.payMin) return 'From $' + job.payMin.toLocaleString() + unit;
    if (job.payMax) return 'Up to $' + job.payMax.toLocaleString() + unit;
    return null;
  }

  function formatEmploymentType(type) {
    const map = {
      full_time: 'Full Time',
      part_time: 'Part Time',
      seasonal: 'Seasonal',
      contract: 'Contract',
      temporary: 'Temporary',
      internship: 'Internship'
    };
    return map[type] || type;
  }

  function renderJobs(data) {
    if (!data.ok) {
      widget.innerHTML = '<div class="cc-jobs-error">Unable to load jobs</div>';
      return;
    }

    if (data.jobs.length === 0) {
      widget.innerHTML = '<div class="cc-jobs-empty">No job openings at this time</div>';
      return;
    }

    let html = '<div class="cc-jobs-header"><h3 class="cc-jobs-title">Job Openings</h3></div>';
    html += '<div class="cc-jobs-list">';

    data.jobs.forEach(function(job) {
      const pay = formatPay(job);
      html += '<div class="cc-job-card">';
      html += '<h4 class="cc-job-title">' + escapeHtml(job.title) + '</h4>';
      html += '<div class="cc-job-meta">';
      
      if (job.employment_type) {
        html += '<span class="cc-job-tag">' + formatEmploymentType(job.employment_type) + '</span>';
      }
      
      if (job.location_text) {
        html += '<span class="cc-job-location">' + escapeHtml(job.location_text) + '</span>';
      }
      
      if (pay) {
        html += '<span class="cc-job-pay">' + pay + '</span>';
      }

      if (job.housing_provided) {
        html += '<span class="cc-job-tag">Housing Provided</span>';
      }
      
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';

    if (showLogo) {
      html += '<div class="cc-jobs-footer">Powered by <a href="https://communitycanvas.ca" target="_blank" rel="noopener">Community Canvas</a></div>';
    }

    widget.innerHTML = html;

    if (data.jobs.length > 0 && data.jobs[0].schemaOrg) {
      const jsonLdScript = document.createElement('script');
      jsonLdScript.type = 'application/ld+json';
      jsonLdScript.textContent = JSON.stringify(data.jobs.map(function(j) { return j.schemaOrg; }));
      document.head.appendChild(jsonLdScript);
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  fetch(apiBase + '/api/embed/feed/' + encodeURIComponent(embedKey) + '?limit=' + limit)
    .then(function(res) { return res.json(); })
    .then(renderJobs)
    .catch(function(err) {
      console.error('Community Canvas Jobs Widget error:', err);
      widget.innerHTML = '<div class="cc-jobs-error">Failed to load jobs</div>';
    });
})();
