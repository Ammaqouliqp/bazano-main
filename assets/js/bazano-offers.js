// bazano-offers.js

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('offers-list');
  const formEl = document.getElementById('create-offer-form');
  const showBtn = document.getElementById('show-create-offer');
  const cancelBtn = document.getElementById('cancel-offer');
  const submitBtn = document.getElementById('submit-offer');

  showBtn?.addEventListener('click', () => {
    if (!requireAuth()) return;
    formEl.style.display = 'block';
  });

  cancelBtn?.addEventListener('click', () => {
    formEl.style.display = 'none';
  });

  submitBtn?.addEventListener('click', async () => {
    const title = document.getElementById('offer-title').value.trim();
    const description = document.getElementById('offer-desc').value.trim();
    const price = document.getElementById('offer-price').value;
    const category = document.getElementById('offer-category').value.trim();

    if (!title) {
      alert('عنوان پیشنهاد لازم است');
      return;
    }

    try {
      await apiFetch('/offers', 'POST', {
        title,
        description,
        price: price ? Number(price) : null,
        category,
        type: 'product'
      });
      alert('پیشنهاد با موفقیت ثبت شد');
      formEl.style.display = 'none';
      document.getElementById('offer-title').value = '';
      document.getElementById('offer-desc').value = '';
      document.getElementById('offer-price').value = '';
      document.getElementById('offer-category').value = '';
      loadOffers();
    } catch (err) {
      alert(err.message);
    }
  });

  async function loadOffers() {
    try {
      const offers = await apiFetch('/offers');
      if (!offers.length) {
        listEl.innerHTML = '<p class="empty_state">هنوز پیشنهادی ثبت نشده است</p>';
        return;
      }
      listEl.innerHTML = offers.map(o => `
        <div class="offer_card">
          <h3>${escapeHtml(o.title)}</h3>
          <p>${escapeHtml(o.description || '')}</p>
          ${o.price ? `<div class="offer_price">${Number(o.price).toLocaleString('fa-IR')} تومان</div>` : ''}
          <div class="offer_meta">
            ${escapeHtml(o.provider_name || 'ارائه‌دهنده')} · ${escapeHtml(o.category || 'عمومی')}
          </div>
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = '<p class="empty_state">خطا در بارگذاری پیشنهادها</p>';
      console.error(err);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  loadOffers();
});
