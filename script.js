// Theme Toggle
function toggleTheme() {
    const body = document.body;
    const isInverted = body.dataset.theme === 'inverted';
    body.dataset.theme = isInverted ? '' : 'inverted';
    document.querySelector('.toggle-text').textContent = isInverted ? 'Dark' : 'Light';
}

// Heartbeat synchronized pulse waves
const pulseWaves = document.querySelectorAll('.pulse-wave');
let waveIndex = 0;

function triggerPulse() {
    const wave = pulseWaves[waveIndex];
    wave.classList.remove('animate');
    void wave.offsetWidth;
    wave.classList.add('animate');
    waveIndex = (waveIndex + 1) % pulseWaves.length;
}

function heartbeatCycle() {
    setTimeout(() => triggerPulse(), 280);
    setTimeout(() => triggerPulse(), 840);
}

heartbeatCycle();
setInterval(heartbeatCycle, 2800);

// Page Navigation
function showPage(pageId, scrollTo = null) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.add('hidden');
    });
    
    setTimeout(() => {
        document.getElementById(pageId).classList.remove('hidden');
        window.scrollTo(0, 0);
        
        if (scrollTo) {
            setTimeout(() => {
                document.getElementById(scrollTo).scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }
    }, 300);
}

// Lightbox
let currentGallery = '';
let currentIndex = 0;

function openLightbox(gallery, index) {
    currentGallery = gallery;
    currentIndex = index;
    document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

function prevLightbox() {
    const gallery = document.getElementById(currentGallery + '-gallery');
    const items = gallery.querySelectorAll('.masonry-item');
    currentIndex = (currentIndex - 1 + items.length) % items.length;
}

function nextLightbox() {
    const gallery = document.getElementById(currentGallery + '-gallery');
    const items = gallery.querySelectorAll('.masonry-item');
    currentIndex = (currentIndex + 1) % items.length;
}

// Close lightbox on escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevLightbox();
    if (e.key === 'ArrowRight') nextLightbox();
});

// Reveal on scroll
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

reveals.forEach(el => observer.observe(el));

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// Patron Page Functions
let selectedPatronType = 'one-time';

function selectPatronType(type) {
    selectedPatronType = type;
    document.querySelectorAll('.patron-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');
}

async function handlePatronSubmit() {
    const amount = document.getElementById('patron-amount').value;
    
    if (!amount || amount < 100) {
        alert('金額は100円以上を入力してください');
        return;
    }

    // Stripeへリダイレクト
    try {
        const response = await fetch('https://mamonis-patron.xxxmoaomxxx.workers.dev/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: parseInt(amount),
                type: selectedPatronType
            })
        });

        const data = await response.json();
        
        if (data.url) {
            window.location.href = data.url;
        } else {
            alert('エラーが発生しました。もう一度お試しください。');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('エラーが発生しました。もう一度お試しください。');
    }
}
