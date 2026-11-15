export const CATEGORIES=['All','Electronics & Media','Home & Garden','Clothing & Accessories','Books & Supplies','Toys, Games & Hobbies','Vehicles','Other'];
export const CONDITIONS=['New','Open box','Reconditioned','Used','For parts','Other'];
export const SAMPLE_EMAIL='demo@studentexchange.test';
export const SAMPLE_PASSWORD='CampusDemo!23';
export function validateLogin(email,password){
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))return 'Enter a valid email address.';
 if(!password)return 'Enter your password.';
 if(email.trim().toLowerCase()!==SAMPLE_EMAIL||password!==SAMPLE_PASSWORD)return 'Use the sample account below. Real accounts are not connected yet.';
 return '';
}
export function filterItems(items,{query='',category='All',min='',max='',conditions=[]}={}){
 return items.filter(i=>(category==='All'||i.category===category)&&(!query||`${i.title} ${i.description} ${i.category}`.toLowerCase().includes(query.trim().toLowerCase()))&&(min===''||i.price>=Number(min))&&(max===''||i.price<=Number(max))&&(!conditions.length||conditions.includes(i.condition)));
}
export function validatePost(p){
 if(!p.title?.trim())return 'Give your item a title.';
 if(p.title.trim().length>80)return 'Keep the title under 80 characters.';
 if(p.price===''||!Number.isFinite(Number(p.price))||Number(p.price)<0)return 'Enter a valid price of $0 or more.';
 if(!CATEGORIES.slice(1).includes(p.category))return 'Choose a category.';
 if(!CONDITIONS.includes(p.condition))return 'Choose an item condition.';
 if(!p.location?.trim())return 'Enter a pickup area.';
 return '';
}
export const SEED=[
 {id:'s1',title:'Sony-style wireless headphones',price:45,category:'Electronics & Media',condition:'Used',location:'Auraria campus',description:'Sample listing. Comfortable over-ear headphones for study sessions. Includes charging cable.',kind:'headphones',tone:'lilac',seller:'Jordan',age:'2h ago'},
 {id:'s2',title:'Calculus textbook',price:25,category:'Books & Supplies',condition:'Used',location:'CU Denver',description:'Sample listing. A used calculus textbook with some margin notes. Check your course edition before buying.',kind:'book',tone:'peach',seller:'Sam',age:'3h ago'},
 {id:'s3',title:'Little desk lamp',price:18,category:'Home & Garden',condition:'Open box',location:'Downtown Denver',description:'Sample listing. Adjustable desk lamp for a cozy study corner.',kind:'lamp',tone:'sage',seller:'Riley',age:'4h ago'},
 {id:'s4',title:'Everyday campus backpack',price:30,category:'Clothing & Accessories',condition:'Used',location:'Auraria campus',description:'Sample listing. Plenty of room for your laptop, notebooks, and snacks.',kind:'backpack',tone:'sand',seller:'Morgan',age:'5h ago'},
 {id:'s5',title:'Easy-care desk plant',price:8,category:'Home & Garden',condition:'Other',location:'CU Denver',description:'Sample listing. A small leafy plant in a terracotta pot. Bright, indirect light works best.',kind:'plant',tone:'rose',seller:'Casey',age:'6h ago'},
 {id:'s6',title:'Scientific calculator',price:15,category:'Books & Supplies',condition:'Used',location:'Auraria campus',description:'Sample listing. A simple scientific calculator. Confirm your instructor allows the model you buy.',kind:'calculator',tone:'blue',seller:'Taylor',age:'7h ago'},
 {id:'s7',title:'Cozy campus hoodie',price:20,category:'Clothing & Accessories',condition:'New',location:'Downtown Denver',description:'Sample listing. An unworn forest-green hoodie, size medium.',kind:'hoodie',tone:'sage',seller:'Avery',age:'8h ago'},
 {id:'s8',title:'A game-night classic',price:12,category:'Toys, Games & Hobbies',condition:'Used',location:'CU Denver',description:'Sample listing. A colorful board game for your next study-break night.',kind:'game',tone:'peach',seller:'Quinn',age:'1d ago'}
];
