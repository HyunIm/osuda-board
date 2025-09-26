// 전역 변수
let currentView = 'daily';
let currentDate = new Date();
let currentWeek = new Date();
let currentMonth = new Date();
let posts = [];
let keywords = [];
let editingPostId = null;

// DOM 요소들
const navTabs = document.querySelectorAll('.nav-tab');
const viewContents = document.querySelectorAll('.view-content');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const keywordFilter = document.getElementById('keywordFilter');
const sortFilter = document.getElementById('sortFilter');
const dailyDate = document.getElementById('dailyDate');
const prevDay = document.getElementById('prevDay');
const nextDay = document.getElementById('nextDay');
const weekRange = document.getElementById('weekRange');
const prevWeek = document.getElementById('prevWeek');
const nextWeek = document.getElementById('nextWeek');
const monthYear = document.getElementById('monthYear');
const prevMonth = document.getElementById('prevMonth');
const nextMonth = document.getElementById('nextMonth');
const addPostBtn = document.getElementById('addPostBtn');
const postModal = document.getElementById('postModal');
const detailModal = document.getElementById('detailModal');
const postForm = document.getElementById('postForm');
const postContent = document.getElementById('postContent');
const postKeywords = document.getElementById('postKeywords');
const postDate = document.getElementById('postDate');
const dateOptions = document.querySelectorAll('input[name="dateOption"]');
const modalTitle = document.getElementById('modalTitle');
const postDetail = document.getElementById('postDetail');
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');
const closeButtons = document.querySelectorAll('.close');

// 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadPosts();
    loadKeywords();
    updateDateInputs();
});

// 앱 초기화
function initializeApp() {
    // 오늘 날짜로 초기화
    const today = new Date();
    currentDate = new Date(today);
    currentWeek = new Date(today);
    currentMonth = new Date(today);
    
    // 날짜 입력 필드 초기화
    dailyDate.value = formatDateForInput(today);
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 네비게이션 탭
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // 검색 및 필터
    searchBtn.addEventListener('click', () => loadPosts());
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadPosts();
    });
    keywordFilter.addEventListener('change', () => loadPosts());
    sortFilter.addEventListener('change', () => loadPosts());

    // 날짜 네비게이션
    prevDay.addEventListener('click', () => changeDate(-1));
    nextDay.addEventListener('click', () => changeDate(1));
    dailyDate.addEventListener('change', () => {
        currentDate = new Date(dailyDate.value);
        loadPosts();
    });

    prevWeek.addEventListener('click', () => changeWeek(-1));
    nextWeek.addEventListener('click', () => changeWeek(1));

    prevMonth.addEventListener('click', () => changeMonth(-1));
    nextMonth.addEventListener('click', () => changeMonth(1));

    // 모달 관련
    addPostBtn.addEventListener('click', () => openPostModal());
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => closeModals());
    });

    // 폼 제출
    postForm.addEventListener('submit', handlePostSubmit);

    // 날짜 옵션 변경
    dateOptions.forEach(option => {
        option.addEventListener('change', handleDateOptionChange);
    });

    // 모달 외부 클릭으로 닫기
    window.addEventListener('click', (e) => {
        if (e.target === postModal) closeModals();
        if (e.target === detailModal) closeModals();
    });

    // 상세보기 액션
    editBtn.addEventListener('click', () => editPost());
    deleteBtn.addEventListener('click', () => deletePost());
}

// 뷰 전환
function switchView(view) {
    currentView = view;
    
    // 탭 활성화
    navTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.view === view);
    });
    
    // 뷰 컨텐츠 전환
    viewContents.forEach(content => {
        content.classList.toggle('active', content.id === view + 'View');
    });
    
    // 뷰별 데이터 로드
    switch(view) {
        case 'daily':
            loadDailyView();
            break;
        case 'weekly':
            loadWeeklyView();
            break;
        case 'monthly':
            loadMonthlyView();
            break;
    }
}

// 게시물 로드
async function loadPosts() {
    try {
        const params = new URLSearchParams();
        
        if (searchInput.value) params.append('search', searchInput.value);
        if (keywordFilter.value) params.append('keyword', keywordFilter.value);
        if (sortFilter.value) params.append('sort', sortFilter.value);
        
        if (currentView === 'daily') {
            params.append('date', formatDateForAPI(currentDate));
        }
        
        const response = await fetch(`/api/posts?${params}`);
        posts = await response.json();
        
        renderCurrentView();
    } catch (error) {
        console.error('게시물 로드 오류:', error);
        alert('게시물을 불러오는 중 오류가 발생했습니다.');
    }
}

// 키워드 로드
async function loadKeywords() {
    try {
        const response = await fetch('/api/keywords');
        keywords = await response.json();
        
        // 키워드 필터 업데이트
        keywordFilter.innerHTML = '<option value="">키워드 선택</option>';
        keywords.forEach(keyword => {
            const option = document.createElement('option');
            option.value = keyword;
            option.textContent = keyword;
            keywordFilter.appendChild(option);
        });
    } catch (error) {
        console.error('키워드 로드 오류:', error);
    }
}

// 일간 뷰 로드
function loadDailyView() {
    updateDateInputs();
    loadPosts();
}

// 주간 뷰 로드
async function loadWeeklyView() {
    updateWeekRange();
    await loadWeeklyData();
}

// 월간 뷰 로드
async function loadMonthlyView() {
    updateMonthYear();
    await loadMonthlyData();
}

// 주간 데이터 로드
async function loadWeeklyData() {
    try {
        const startDate = getWeekStart(currentWeek);
        const endDate = getWeekEnd(currentWeek);
        
        const response = await fetch(`/api/stats?start_date=${formatDateForAPI(startDate)}&end_date=${formatDateForAPI(endDate)}`);
        const stats = await response.json();
        
        renderWeeklyCalendar(stats);
    } catch (error) {
        console.error('주간 데이터 로드 오류:', error);
    }
}

// 월간 데이터 로드
async function loadMonthlyData() {
    try {
        const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
        
        const response = await fetch(`/api/stats?start_date=${formatDateForAPI(startDate)}&end_date=${formatDateForAPI(endDate)}`);
        const stats = await response.json();
        
        renderMonthlyCalendar(stats);
    } catch (error) {
        console.error('월간 데이터 로드 오류:', error);
    }
}

// 현재 뷰 렌더링
function renderCurrentView() {
    switch(currentView) {
        case 'daily':
            renderDailyPosts();
            break;
        case 'weekly':
            renderWeeklyCalendar();
            break;
        case 'monthly':
            renderMonthlyCalendar();
            break;
    }
}

// 일간 게시물 렌더링
function renderDailyPosts() {
    const container = document.getElementById('dailyPosts');
    container.innerHTML = '';
    
    if (posts.length === 0) {
        container.innerHTML = '<div class="no-posts">등록된 기록이 없습니다.</div>';
        return;
    }
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

// 주간 캘린더 렌더링
function renderWeeklyCalendar(stats = []) {
    const container = document.getElementById('weeklyCalendar');
    container.innerHTML = '';
    
    const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
    const startDate = getWeekStart(currentWeek);
    
    // 요일 헤더
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'weekday-header';
        header.textContent = day;
        container.appendChild(header);
    });
    
    // 요일별 셀
    for (let i = 0; i < 7; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const cell = document.createElement('div');
        cell.className = 'weekday-cell';
        cell.dataset.date = formatDateForAPI(cellDate);
        
        const dayNumber = cellDate.getDate();
        cell.innerHTML = `<div>${dayNumber}</div>`;
        
        // 해당 날짜의 통계 확인
        const dayStats = stats.find(stat => stat.date === formatDateForAPI(cellDate));
        if (dayStats) {
            cell.classList.add('has-posts');
            cell.innerHTML += `<div class="weekday-preview">${dayStats.count}건</div>`;
        }
        
        cell.addEventListener('click', () => {
            currentDate = new Date(cellDate);
            switchView('daily');
        });
        
        container.appendChild(cell);
    }
}

// 월간 캘린더 렌더링
function renderMonthlyCalendar(stats = []) {
    const container = document.getElementById('monthlyCalendar');
    container.innerHTML = '';
    
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    // 요일 헤더
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    weekdays.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.textContent = day;
        container.appendChild(header);
    });
    
    // 달력 셀
    for (let i = 0; i < 42; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.dataset.date = formatDateForAPI(cellDate);
        
        const dayNumber = cellDate.getDate();
        cell.innerHTML = `<div>${dayNumber}</div>`;
        
        // 현재 월이 아닌 날짜 스타일링
        if (cellDate.getMonth() !== month) {
            cell.style.opacity = '0.3';
        }
        
        // 해당 날짜의 통계 확인
        const dayStats = stats.find(stat => stat.date === formatDateForAPI(cellDate));
        if (dayStats) {
            cell.classList.add('has-posts');
            const countElement = document.createElement('div');
            countElement.className = 'post-count';
            countElement.textContent = dayStats.count;
            cell.appendChild(countElement);
        }
        
        cell.addEventListener('click', () => {
            currentDate = new Date(cellDate);
            switchView('daily');
        });
        
        container.appendChild(cell);
    }
}

// 게시물 요소 생성
function createPostElement(post) {
    const element = document.createElement('div');
    element.className = 'post-item';
    element.dataset.id = post.id;
    
    const keywords = post.keywords ? post.keywords.split(',').map(k => k.trim()).filter(k => k) : [];
    const keywordsHtml = keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('');
    
    element.innerHTML = `
        <div class="post-content">${post.content}</div>
        <div class="post-meta">
            <div class="post-keywords">${keywordsHtml}</div>
            <div class="post-date">${formatDateTime(post.manual_date || post.created_at)}</div>
        </div>
    `;
    
    element.addEventListener('click', () => showPostDetail(post.id));
    
    return element;
}

// 게시물 상세 보기
async function showPostDetail(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}`);
        const post = await response.json();
        
        const keywords = post.keywords ? post.keywords.split(',').map(k => k.trim()).filter(k => k) : [];
        const keywordsHtml = keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('');
        
        postDetail.innerHTML = `
            <div class="post-content">${post.content}</div>
            <div class="post-meta">
                <div class="post-keywords">${keywordsHtml}</div>
                <div class="post-date">${formatDateTime(post.manual_date || post.created_at)}</div>
            </div>
        `;
        
        editBtn.dataset.id = post.id;
        deleteBtn.dataset.id = post.id;
        
        detailModal.style.display = 'block';
    } catch (error) {
        console.error('게시물 상세 로드 오류:', error);
        alert('게시물을 불러오는 중 오류가 발생했습니다.');
    }
}

// 게시물 작성 모달 열기
function openPostModal(postId = null) {
    editingPostId = postId;
    
    if (postId) {
        modalTitle.textContent = '기록 수정';
        loadPostForEdit(postId);
    } else {
        modalTitle.textContent = '새 기록 작성';
        postForm.reset();
        postDate.disabled = true;
        document.querySelector('input[name="dateOption"][value="auto"]').checked = true;
    }
    
    postModal.style.display = 'block';
}

// 게시물 수정을 위한 데이터 로드
async function loadPostForEdit(postId) {
    try {
        const response = await fetch(`/api/posts/${postId}`);
        const post = await response.json();
        
        postContent.value = post.content;
        postKeywords.value = post.keywords || '';
        
        if (post.manual_date) {
            document.querySelector('input[name="dateOption"][value="manual"]').checked = true;
            postDate.value = formatDateTimeForInput(post.manual_date);
            postDate.disabled = false;
        } else {
            document.querySelector('input[name="dateOption"][value="auto"]').checked = true;
            postDate.disabled = true;
        }
    } catch (error) {
        console.error('게시물 로드 오류:', error);
        alert('게시물을 불러오는 중 오류가 발생했습니다.');
    }
}

// 게시물 수정
function editPost() {
    const postId = editBtn.dataset.id;
    openPostModal(postId);
    detailModal.style.display = 'none';
}

// 게시물 삭제
async function deletePost() {
    const postId = deleteBtn.dataset.id;
    
    if (!confirm('정말로 이 기록을 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/posts/${postId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert('기록이 삭제되었습니다.');
            closeModals();
            loadPosts();
        } else {
            const error = await response.json();
            alert(error.error || '삭제 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('게시물 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// 폼 제출 처리
async function handlePostSubmit(e) {
    e.preventDefault();
    
    const formData = {
        content: postContent.value.trim(),
        keywords: postKeywords.value.trim(),
        manual_date: null
    };
    
    if (document.querySelector('input[name="dateOption"]:checked').value === 'manual' && postDate.value) {
        formData.manual_date = postDate.value;
    }
    
    if (!formData.content) {
        alert('내용을 입력해주세요.');
        return;
    }
    
    try {
        const url = editingPostId ? `/api/posts/${editingPostId}` : '/api/posts';
        const method = editingPostId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            alert(editingPostId ? '기록이 수정되었습니다.' : '기록이 저장되었습니다.');
            closeModals();
            loadPosts();
            loadKeywords();
        } else {
            const error = await response.json();
            alert(error.error || '저장 중 오류가 발생했습니다.');
        }
    } catch (error) {
        console.error('게시물 저장 오류:', error);
        alert('저장 중 오류가 발생했습니다.');
    }
}

// 날짜 옵션 변경 처리
function handleDateOptionChange() {
    const selectedOption = document.querySelector('input[name="dateOption"]:checked').value;
    postDate.disabled = selectedOption === 'auto';
    
    if (selectedOption === 'manual' && !postDate.value) {
        postDate.value = formatDateTimeForInput(new Date());
    }
}

// 모달 닫기
function closeModals() {
    postModal.style.display = 'none';
    detailModal.style.display = 'none';
    editingPostId = null;
}

// 날짜 변경
function changeDate(direction) {
    currentDate.setDate(currentDate.getDate() + direction);
    dailyDate.value = formatDateForInput(currentDate);
    loadPosts();
}

// 주간 변경
function changeWeek(direction) {
    currentWeek.setDate(currentWeek.getDate() + (direction * 7));
    loadWeeklyView();
}

// 월 변경
function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    loadMonthlyView();
}

// 날짜 입력 필드 업데이트
function updateDateInputs() {
    dailyDate.value = formatDateForInput(currentDate);
}

// 주간 범위 업데이트
function updateWeekRange() {
    const startDate = getWeekStart(currentWeek);
    const endDate = getWeekEnd(currentWeek);
    weekRange.textContent = `${formatDateForDisplay(startDate)} ~ ${formatDateForDisplay(endDate)}`;
}

// 월/년 업데이트
function updateMonthYear() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    monthYear.textContent = `${year}년 ${month}월`;
}

// 유틸리티 함수들
function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
}

function formatDateForAPI(date) {
    return date.toISOString().split('T')[0];
}

function formatDateForDisplay(date) {
    return date.toLocaleDateString('ko-KR');
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
}

function formatDateTimeForInput(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function getWeekEnd(date) {
    const start = getWeekStart(new Date(date));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return end;
}
