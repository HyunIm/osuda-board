const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { put, list } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public', { 
  setHeaders: (res, path) => {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

// Vercel Blob 기반 데이터베이스
let posts = [];

// 데이터베이스 초기화
async function initDatabase() {
  try {
    await loadDatabase();
    console.log('Vercel Blob 데이터베이스가 초기화되었습니다.');
    console.log('현재 게시물 수:', posts.length);
  } catch (error) {
    console.error('데이터베이스 초기화 오류:', error.message);
    posts = [];
  }
}

// 데이터베이스 저장 (Vercel Blob)
async function saveDatabase() {
  try {
    console.log('=== Blob 저장 시작 ===');
    console.log('저장할 게시물 수:', posts.length);
    console.log('게시물 데이터:', JSON.stringify(posts, null, 2));
    
    const data = JSON.stringify(posts, null, 2);
    console.log('JSON 데이터 크기:', data.length, 'bytes');
    
    // 고정된 파일명 사용 (덮어쓰기)
    const blob = await put('osuda-data.json', data, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false  // 랜덤 접미사 제거
    });
    
    console.log('✅ 데이터가 Vercel Blob에 저장되었습니다!');
    console.log('Blob URL:', blob.url);
    console.log('Blob 크기:', blob.size || 'N/A', 'bytes');
    console.log('=== Blob 저장 완료 ===');
  } catch (error) {
    console.error('❌ Blob 저장 오류:', error.message);
    console.error('오류 상세:', error);
  }
}

// 데이터베이스 로드 (Vercel Blob)
async function loadDatabase() {
  try {
    console.log('=== Blob 로드 시작 ===');
    const { blobs } = await list({ prefix: 'osuda-data' });
    console.log('찾은 Blob 파일 수:', blobs.length);
    console.log('Blob 파일 목록:', blobs.map(b => b.pathname));
    
    if (blobs.length > 0) {
      // 가장 최근 파일 찾기 (정확한 파일명으로)
      const targetBlob = blobs.find(blob => blob.pathname === 'osuda-data.json') || blobs[0];
      console.log('로드할 Blob 파일:', targetBlob.pathname);
      console.log('Blob 파일 정보:', targetBlob);
      
      const response = await fetch(targetBlob.url);
      console.log('HTTP 응답 상태:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        posts = data;
        console.log('✅ 데이터가 Vercel Blob에서 로드되었습니다');
        console.log('로드된 게시물 수:', posts.length);
      } else {
        posts = [];
        console.log('❌ HTTP 응답 오류:', response.status);
      }
    } else {
      posts = [];
      console.log('📝 저장된 데이터가 없습니다 (첫 실행)');
    }
    console.log('=== Blob 로드 완료 ===');
  } catch (error) {
    console.error('❌ Blob 로드 오류:', error.message);
    console.error('오류 상세:', error);
    posts = [];
  }
}

// 데이터베이스 초기화 실행
initDatabase();

// API 라우트들
// 모든 게시물 조회
app.get('/api/posts', (req, res) => {
  console.log('=== 게시물 조회 요청 ===');
  console.log('현재 메모리의 게시물 수:', posts.length);
  console.log('조회 파라미터:', req.query);
  
  const { search, keyword, sort = 'newest', date } = req.query;
  let filteredPosts = [...posts];

  // 검색 필터
  if (search) {
    filteredPosts = filteredPosts.filter(post => 
      post.content.toLowerCase().includes(search.toLowerCase())
    );
  }

  // 키워드 필터
  if (keyword) {
    filteredPosts = filteredPosts.filter(post => 
      post.keywords && post.keywords.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  // 날짜 필터
  if (date) {
    filteredPosts = filteredPosts.filter(post => {
      const postDate = post.manual_date || post.created_at;
      return postDate.startsWith(date);
    });
  }

  // 정렬
  filteredPosts.sort((a, b) => {
    const dateA = new Date(a.manual_date || a.created_at);
    const dateB = new Date(b.manual_date || b.created_at);
    return sort === 'oldest' ? dateA - dateB : dateB - dateA;
  });

  console.log('필터링된 게시물 수:', filteredPosts.length);
  console.log('=== 게시물 조회 완료 ===');
  
  res.json(filteredPosts);
});

// 특정 게시물 조회
app.get('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const post = posts.find(p => p.id === parseInt(id));
  
  if (!post) {
    res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
    return;
  }
  
  res.json(post);
});

// 게시물 생성
app.post('/api/posts', async (req, res) => {
  console.log('=== 게시물 생성 요청 ===');
  console.log('요청 데이터:', req.body);
  console.log('생성 전 게시물 수:', posts.length);
  
  const { content, keywords, manual_date } = req.body;
  
  if (!content) {
    console.log('❌ 내용이 없어서 생성 실패');
    res.status(400).json({ error: '내용은 필수입니다.' });
    return;
  }

  const newPost = {
    id: posts.length > 0 ? Math.max(...posts.map(p => p.id)) + 1 : 1,
    content,
    keywords: keywords || '',
    created_at: new Date().toISOString(),
    manual_date: manual_date || null
  };

  console.log('생성할 게시물:', newPost);
  posts.push(newPost);
  console.log('생성 후 게시물 수:', posts.length);
  
  console.log('Blob에 저장 시작...');
  await saveDatabase();
  console.log('=== 게시물 생성 완료 ===');
  
  res.json({ id: newPost.id, message: '게시물이 생성되었습니다.' });
});

// 게시물 수정
app.put('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  const { content, keywords, manual_date } = req.body;
  
  if (!content) {
    res.status(400).json({ error: '내용은 필수입니다.' });
    return;
  }

  const postIndex = posts.findIndex(p => p.id === parseInt(id));
  
  if (postIndex === -1) {
    res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
    return;
  }

  posts[postIndex] = {
    ...posts[postIndex],
    content,
    keywords: keywords || '',
    manual_date: manual_date || null
  };

  await saveDatabase();
  res.json({ message: '게시물이 수정되었습니다.' });
});

// 게시물 삭제
app.delete('/api/posts/:id', async (req, res) => {
  const { id } = req.params;
  const postIndex = posts.findIndex(p => p.id === parseInt(id));
  
  if (postIndex === -1) {
    res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
    return;
  }

  posts.splice(postIndex, 1);
  await saveDatabase();
  
  res.json({ message: '게시물이 삭제되었습니다.' });
});

// 키워드 목록 조회
app.get('/api/keywords', (req, res) => {
  const allKeywords = posts
    .filter(post => post.keywords && post.keywords.trim())
    .flatMap(post => 
      post.keywords.split(',').map(k => k.trim()).filter(k => k)
    );
  
  const uniqueKeywords = [...new Set(allKeywords)];
  res.json(uniqueKeywords);
});

// 날짜별 통계 조회
app.get('/api/stats', (req, res) => {
  const { start_date, end_date } = req.query;
  let filteredPosts = posts;

  if (start_date && end_date) {
    filteredPosts = posts.filter(post => {
      const postDate = post.manual_date || post.created_at;
      const date = postDate.split('T')[0];
      return date >= start_date && date <= end_date;
    });
  }

  // 날짜별 그룹화
  const stats = {};
  filteredPosts.forEach(post => {
    const postDate = post.manual_date || post.created_at;
    const date = postDate.split('T')[0];
    stats[date] = (stats[date] || 0) + 1;
  });

  const result = Object.entries(stats).map(([date, count]) => ({
    date,
    count
  })).sort((a, b) => a.date.localeCompare(b.date));

  res.json(result);
});

// 정적 파일 라우트
app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'styles.css'));
});

app.get('/script.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'script.js'));
});

// 메인 페이지 서빙
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 http://0.0.0.0:${PORT} 에서 실행 중입니다.`);
  console.log(`외부 접속: http://[공인IP]:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('서버가 종료됩니다.');
  await saveDatabase();
  process.exit(0);
});
