import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { db } from "./firebase.js";
function card(course) {
 const article=document.createElement("article"); article.className="course-card";
 const visual=document.createElement("div"); visual.className="course-visual"; visual.innerHTML='<span class="course-visual-mark">TBARC</span>';
 const content=document.createElement("div"); content.className="course-card-content";
 const label=document.createElement("p"); label.className="eyebrow"; label.textContent="COURSE";
 const title=document.createElement("h3"); title.textContent=course.title||"Untitled course";
 const desc=document.createElement("p"); desc.className="course-description"; desc.textContent=course.description||"Course information will be updated soon.";
 const link=document.createElement("a"); link.className="button button-dark"; link.href="login.html?course="+encodeURIComponent(course.id); link.textContent="Sign in for access";
 content.append(label,title,desc,link); article.append(visual,content); return article;
}
async function render(targetId,messageId,limit=0){
 const target=document.getElementById(targetId); if(!target)return;
 try{
  const snap=await getDocs(query(collection(db,"courses"),where("published","==",true)));
  const list=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  target.replaceChildren();
  const shown=limit?list.slice(0,limit):list;
  if(!shown.length){target.innerHTML='<div class="empty-state"><h3>No courses published yet</h3><p>New learning opportunities will appear here when announced.</p></div>';return;}
  shown.forEach(c=>target.append(card(c)));
 }catch(e){console.error(e);target.innerHTML='<div class="empty-state"><h3>Courses temporarily unavailable</h3><p>Please refresh or contact TBARC Academy.</p></div>';const m=document.getElementById(messageId);if(m)m.textContent="Check Firestore rules: published courses must be readable publicly.";}
}
export {render};