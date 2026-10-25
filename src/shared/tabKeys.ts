// Keyboard support for a row of ARIA tabs (roving tabindex): Left/Right move to the previous/next tab (wrapping), Home/End to the first/last.
// Returns the index of the tab to select and focus, or null when the key is not a tab key.
export function nextTabIndex(key:string,current:number,count:number):number|null{
 if(count<1)return null;
 switch(key){
  case 'ArrowRight':return (current+1)%count;
  case 'ArrowLeft':return (current-1+count)%count;
  case 'Home':return 0;
  case 'End':return count-1;
  default:return null;
 }
}
