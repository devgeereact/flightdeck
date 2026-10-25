(function(){var root=document.getElementById('packing-board');if(!root)return;
var secs=[].slice.call(root.querySelectorAll('.ck-sec')),items=[].slice.call(root.querySelectorAll('.ck-rail-item'));
var KEY='flightdeck-public-packing',saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
function show(id,push){var found=false;secs.forEach(function(s){var on=s.id===id;if(on)found=true;s.hidden=!on});if(!found){id=secs[0].id;secs[0].hidden=false}
items.forEach(function(a){var on=a.getAttribute('data-sec')===id;a.classList.toggle('on',on);if(on)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current')});
if(push&&window.history&&history.replaceState)history.replaceState(null,'','#'+id)}
function count(){secs.forEach(function(s,i){var boxes=s.querySelectorAll('input[type=checkbox]'),n=0;[].forEach.call(boxes,function(b){if(b.checked)n++});var t=n+'/'+boxes.length;
s.querySelector('.ck-sec-count').textContent=t;var a=items[i];a.querySelector('.ck-rail-count').textContent=t;a.querySelector('.ck-rail-bar b').style.width=(boxes.length?n/boxes.length*100:0)+'%';a.classList.toggle('full',boxes.length>0&&n===boxes.length)})}
[].forEach.call(root.querySelectorAll('input[type=checkbox]'),function(b){var k=b.getAttribute('data-k');if(saved[k])b.checked=true;
b.addEventListener('change',function(){if(b.checked)saved[k]=1;else delete saved[k];try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(e){}count()})});
root.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a)return;var id=a.getAttribute('href').slice(1);if(!document.getElementById(id))return;
e.preventDefault();show(id,true);var top=root.getBoundingClientRect().top+window.scrollY-16;if(window.scrollY>top)window.scrollTo(0,top)});
count();show((location.hash||'').slice(1)||secs[0].id,false)})();
