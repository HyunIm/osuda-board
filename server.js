const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

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

// JSON 파일 기반 데이터베이스
const DB_FILE = 'osuda.json';
let posts = [];

// 데이터베이스 초기화
function initDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      posts = JSON.parse(data);
    } else {
      posts = [];
      saveDatabase();
    }
    console.log('JSON 데이터베이스가 초기화되었습니다.');
  } catch (error) {
    console.error('데이터베이스 초기화 오류:', error.message);
    posts = [];
  }
}

// 데이터베이스 저장
function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(posts, null, 2));
  } catch (error) {
    console.error('데이터베이스 저장 오류:', error.message);
  }
}

// 데이터베이스 초기화 실행
initDatabase();

// API 라우트들
// 모든 게시물 조회
app.get('/api/posts', (req, res) => {
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
app.post('/api/posts', (req, res) => {
  const { content, keywords, manual_date } = req.body;
  
  if (!content) {
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

  posts.push(newPost);
  saveDatabase();
  
  res.json({ id: newPost.id, message: '게시물이 생성되었습니다.' });
});

// 게시물 수정
app.put('/api/posts/:id', (req, res) => {
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

  saveDatabase();
  res.json({ message: '게시물이 수정되었습니다.' });
});

// 게시물 삭제
app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const postIndex = posts.findIndex(p => p.id === parseInt(id));
  
  if (postIndex === -1) {
    res.status(404).json({ error: '게시물을 찾을 수 없습니다.' });
    return;
  }

  posts.splice(postIndex, 1);
  saveDatabase();
  
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
process.on('SIGINT', () => {
  console.log('서버가 종료됩니다.');
  saveDatabase();
  process.exit(0);
});
