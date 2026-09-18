// bazano-needs.js

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('needs-list');
  const formEl = document.getElementById('create-need-form');
  const showBtn = document.getElementById('show-create-need');
  const cancelBtn = document.getElementById('cancel-need');
  const submitBtn = document.getElementById('submit-need');

  showBtn?.addEventListener('click', () => {
    if (!requireAuth()) return;
    formEl.style.display = 'block';
  });

  cancelBtn?.addEventListener('click', () => {
    formEl.style.display = 'none';
  });

  submitBtn?.addEventListener('click', async () => {
    const title = document.getElementById('need-title').value.trim();
    const description = document.getElementById('need-desc').value.trim();
    const category = document.getElementById('need-category').value.trim();

    if (!title) {
      alert('عنوان نیاز لازم است');
      return;
    }

    try {
      await apiFetch('/needs', 'POST', { title, description, category });
      alert('نیاز با موفقیت ثبت شد');
      formEl.style.display = 'none';
      document.getElementById('need-title').value = '';
      document.getElementById('need-desc').value = '';
      document.getElementById('need-category').value = '';
      loadNeeds();
    } catch (err) {
      alert(err.message);
    }
  });

  async function loadNeeds() {
    try {
      const needs = await apiFetch('/needs');
      if (!needs.length) {
        listEl.innerHTML = '<p class="empty_state">هنوز نیازی ثبت نشده است</p>';
        return;
      }
      listEl.innerHTML = needs.map(n => `
        <div class="need_card">
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.description || '')}</p>
          <div class="need_meta">
            ${escapeHtml(n.user_name || 'کاربر')} · ${escapeHtml(n.category || 'عمومی')} · 
            ${n.created_at ? new Date(n.created_at).toLocaleDateString('fa-IR') : ''}
          </div>
        </div>
      `).join('');
    } catch (err) {
      listEl.innerHTML = '<p class="empty_state">خطا در بارگذاری نیازها</p>';
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

  loadNeeds();
});
