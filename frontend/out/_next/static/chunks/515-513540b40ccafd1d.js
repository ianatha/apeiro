(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[515],{74049:function(e,t,n){"use strict";var r=n(36257);function o(){}function i(){}i.resetWarningCache=o,e.exports=function(){function e(e,t,n,o,i,l){if(l!==r){var s=Error("Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types");throw s.name="Invariant Violation",s}}function t(){return e}e.isRequired=e;var n={array:e,bigint:e,bool:e,func:e,number:e,object:e,string:e,symbol:e,any:e,arrayOf:t,element:e,elementType:e,instanceOf:t,node:e,objectOf:t,oneOf:t,oneOfType:t,shape:t,exact:t,checkPropTypes:i,resetWarningCache:o};return n.PropTypes=n,n}},40507:function(e,t,n){e.exports=n(74049)()},36257:function(e){"use strict";e.exports="SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED"},98179:function(e,t,n){"use strict";n.d(t,{Z:function(){return K}});var r=n(50959),o=n(40507);let i="undefined"!=typeof navigator&&navigator.userAgent.toLowerCase().indexOf("firefox")>0;function l(e,t,n,r){e.addEventListener?e.addEventListener(t,n,r):e.attachEvent&&e.attachEvent("on".concat(t),()=>{n(window.event)})}function s(e,t){let n=t.slice(0,t.length-1);for(let t=0;t<n.length;t++)n[t]=e[n[t].toLowerCase()];return n}function a(e){"string"!=typeof e&&(e="");let t=(e=e.replace(/\s/g,"")).split(","),n=t.lastIndexOf("");for(;n>=0;)t[n-1]+=",",t.splice(n,1),n=t.lastIndexOf("");return t}let c={backspace:8,"⌫":8,tab:9,clear:12,enter:13,"↩":13,return:13,esc:27,escape:27,space:32,left:37,up:38,right:39,down:40,del:46,delete:46,ins:45,insert:45,home:36,end:35,pageup:33,pagedown:34,capslock:20,num_0:96,num_1:97,num_2:98,num_3:99,num_4:100,num_5:101,num_6:102,num_7:103,num_8:104,num_9:105,num_multiply:106,num_add:107,num_enter:108,num_subtract:109,num_decimal:110,num_divide:111,"⇪":20,",":188,".":190,"/":191,"`":192,"-":i?173:189,"=":i?61:187,";":i?59:186,"'":222,"[":219,"]":221,"\\":220},u={"⇧":16,shift:16,"⌥":18,alt:18,option:18,"⌃":17,ctrl:17,control:17,"⌘":91,cmd:91,command:91},d={16:"shiftKey",18:"altKey",17:"ctrlKey",91:"metaKey",shiftKey:16,ctrlKey:17,altKey:18,metaKey:91},p={16:!1,18:!1,17:!1,91:!1},f={};for(let e=1;e<20;e++)c["f".concat(e)]=111+e;let h=[],y=!1,m="all",v=[],x=e=>c[e.toLowerCase()]||u[e.toLowerCase()]||e.toUpperCase().charCodeAt(0),k=e=>Object.keys(c).find(t=>c[t]===e),_=e=>Object.keys(u).find(t=>u[t]===e);function g(e){m=e||"all"}function w(){return m||"all"}let b=e=>{let{key:t,scope:n,method:r,splitKey:o="+"}=e;a(t).forEach(e=>{let t=e.split(o),i=t.length,l=t[i-1],a="*"===l?"*":x(l);if(!f[a])return;n||(n=w());let c=i>1?s(u,t):[];f[a]=f[a].filter(e=>!((!r||e.method===r)&&e.scope===n&&function(e,t){let n=e.length>=t.length?e:t,r=e.length>=t.length?t:e,o=!0;for(let e=0;e<n.length;e++)-1===r.indexOf(n[e])&&(o=!1);return o}(e.mods,c)))})};function E(e,t,n,r){let o;if(t.element===r&&(t.scope===n||"all"===t.scope)){for(let e in o=t.mods.length>0,p)Object.prototype.hasOwnProperty.call(p,e)&&(!p[e]&&t.mods.indexOf(+e)>-1||p[e]&&-1===t.mods.indexOf(+e))&&(o=!1);(0!==t.mods.length||p[16]||p[18]||p[17]||p[91])&&!o&&"*"!==t.shortcut||(t.keys=[],t.keys=t.keys.concat(h),!1===t.method(e,t)&&(e.preventDefault?e.preventDefault():e.returnValue=!1,e.stopPropagation&&e.stopPropagation(),e.cancelBubble&&(e.cancelBubble=!0)))}}function C(e,t){let n=f["*"],r=e.keyCode||e.which||e.charCode;if(!N.filter.call(this,e))return;if((93===r||224===r)&&(r=91),-1===h.indexOf(r)&&229!==r&&h.push(r),["ctrlKey","altKey","shiftKey","metaKey"].forEach(t=>{let n=d[t];e[t]&&-1===h.indexOf(n)?h.push(n):!e[t]&&h.indexOf(n)>-1?h.splice(h.indexOf(n),1):"metaKey"===t&&e[t]&&3===h.length&&!(e.ctrlKey||e.shiftKey||e.altKey)&&(h=h.slice(h.indexOf(n)))}),r in p){for(let e in p[r]=!0,u)u[e]===r&&(N[e]=!0);if(!n)return}for(let t in p)Object.prototype.hasOwnProperty.call(p,t)&&(p[t]=e[d[t]]);e.getModifierState&&!(e.altKey&&!e.ctrlKey)&&e.getModifierState("AltGraph")&&(-1===h.indexOf(17)&&h.push(17),-1===h.indexOf(18)&&h.push(18),p[17]=!0,p[18]=!0);let o=w();if(n)for(let r=0;r<n.length;r++)n[r].scope===o&&("keydown"===e.type&&n[r].keydown||"keyup"===e.type&&n[r].keyup)&&E(e,n[r],o,t);if(r in f){for(let n=0;n<f[r].length;n++)if(("keydown"===e.type&&f[r][n].keydown||"keyup"===e.type&&f[r][n].keyup)&&f[r][n].key){let i=f[r][n],{splitKey:l}=i,s=i.key.split(l),a=[];for(let e=0;e<s.length;e++)a.push(x(s[e]));a.sort().join("")===h.sort().join("")&&E(e,i,o,t)}}}function N(e,t,n){var r;h=[];let o=a(e),i=[],c="all",d=document,m=0,k=!1,_=!0,g="+",w=!1,b=!1;for(void 0===n&&"function"==typeof t&&(n=t),"[object Object]"===Object.prototype.toString.call(t)&&(t.scope&&(c=t.scope),t.element&&(d=t.element),t.keyup&&(k=t.keyup),void 0!==t.keydown&&(_=t.keydown),void 0!==t.capture&&(w=t.capture),"string"==typeof t.splitKey&&(g=t.splitKey),!0===t.single&&(b=!0)),"string"==typeof t&&(c=t);m<o.length;m++)e=o[m].split(g),i=[],e.length>1&&(i=s(u,e)),(e="*"===(e=e[e.length-1])?"*":x(e))in f||(f[e]=[]),b&&(f[e]=[]),f[e].push({keyup:k,keydown:_,scope:c,mods:i,shortcut:o[m],method:n,key:o[m],splitKey:g,element:d});void 0!==d&&(r=d,!(v.indexOf(r)>-1))&&window&&(v.push(d),l(d,"keydown",e=>{C(e,d)},w),y||(y=!0,l(window,"focus",()=>{h=[]},w)),l(d,"keyup",e=>{C(e,d),function(e){let t=e.keyCode||e.which||e.charCode,n=h.indexOf(t);if(n>=0&&h.splice(n,1),e.key&&"meta"===e.key.toLowerCase()&&h.splice(0,h.length),(93===t||224===t)&&(t=91),t in p)for(let e in p[t]=!1,u)u[e]===t&&(N[e]=!1)}(e)},w))}let j={getPressedKeyString:function(){return h.map(e=>k(e)||_(e)||String.fromCharCode(e))},setScope:g,getScope:w,deleteScope:function(e,t){let n,r;for(let t in e||(e=w()),f)if(Object.prototype.hasOwnProperty.call(f,t))for(r=0,n=f[t];r<n.length;)n[r].scope===e?n.splice(r,1):r++;w()===e&&g(t||"all")},getPressedKeyCodes:function(){return h.slice(0)},getAllKeyCodes:function(){let e=[];return Object.keys(f).forEach(t=>{f[t].forEach(t=>{let{key:n,scope:r,mods:o,shortcut:i}=t;e.push({scope:r,shortcut:i,mods:o,keys:n.split("+").map(e=>x(e))})})}),e},isPressed:function(e){return"string"==typeof e&&(e=x(e)),-1!==h.indexOf(e)},filter:function(e){let t=e.target||e.srcElement,{tagName:n}=t,r=!0;return(t.isContentEditable||("INPUT"===n||"TEXTAREA"===n||"SELECT"===n)&&!t.readOnly)&&(r=!1),r},trigger:function(e){let t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"all";Object.keys(f).forEach(n=>{f[n].filter(n=>n.scope===t&&n.shortcut===e).forEach(e=>{e&&e.method&&e.method()})})},unbind:function(e){if(void 0===e)Object.keys(f).forEach(e=>delete f[e]);else if(Array.isArray(e))e.forEach(e=>{e.key&&b(e)});else if("object"==typeof e)e.key&&b(e);else if("string"==typeof e){for(var t=arguments.length,n=Array(t>1?t-1:0),r=1;r<t;r++)n[r-1]=arguments[r];let[o,i]=n;"function"==typeof o&&(i=o,o=""),b({key:e,scope:o,method:i,splitKey:"+"})}},keyMap:c,modifier:u,modifierMap:d};for(let e in j)Object.prototype.hasOwnProperty.call(j,e)&&(N[e]=j[e]);if("undefined"!=typeof window){let e=window.hotkeys;N.noConflict=t=>(t&&window.hotkeys===N&&(window.hotkeys=e),N),window.hotkeys=N}class K extends r.Component{constructor(e){super(e),this.isKeyDown=!1,this.handle=void 0,this.onKeyDown=this.onKeyDown.bind(this),this.onKeyUp=this.onKeyUp.bind(this),this.handleKeyUpEvent=this.handleKeyUpEvent.bind(this),this.handle={}}componentDidMount(){var{filter:e,splitKey:t}=this.props;e&&(N.filter=e),N.unbind(this.props.keyName),N(this.props.keyName,{splitKey:t},this.onKeyDown),document&&document.body.addEventListener("keyup",this.handleKeyUpEvent)}componentWillUnmount(){N.unbind(this.props.keyName),this.isKeyDown=!0,this.handle={},document&&document.body.removeEventListener("keyup",this.handleKeyUpEvent)}onKeyUp(e,t){var{onKeyUp:n,disabled:r}=this.props;!r&&n&&n(t.shortcut,e,t)}onKeyDown(e,t){var{onKeyDown:n,allowRepeat:r,disabled:o}=this.props;(!this.isKeyDown||r)&&(this.isKeyDown=!0,this.handle=t,!o&&n&&n(t.shortcut,e,t))}handleKeyUpEvent(e){this.isKeyDown&&(this.isKeyDown=!1,this.props.keyName&&0>this.props.keyName.indexOf(this.handle.shortcut)||(this.onKeyUp(e,this.handle),this.handle={}))}render(){return this.props.children||null}}K.defaultProps={filter(e){var t=e.target||e.srcElement,n=t.tagName;return!(t.isContentEditable||"INPUT"===n||"SELECT"===n||"TEXTAREA"===n)}},K.propTypes={keyName:o.string,filter:o.func,onKeyDown:o.func,onKeyUp:o.func,disabled:o.bool,splitKey:o.string}},42384:function(e,t,n){"use strict";n.d(t,{o:function(){return a}});var r=n(64933),o=n(586),i=n(24843),l=n(94628),s=n(11527),a=(0,l.G)((e,t)=>{let{onClick:n,className:l,...a}=e,{onClose:c}=(0,r.vR)(),u=(0,i.cx)("chakra-modal__close-btn",l),d=(0,r.I_)();return(0,s.jsx)(o.P,{ref:t,__css:d.closeButton,className:u,onClick:(0,i.v0)(n,e=>{e.stopPropagation(),c()}),...a})});a.displayName="ModalCloseButton"},93493:function(e,t,n){"use strict";n.d(t,{x:function(){return c}});var r=n(64933),o=n(24843),i=n(94628),l=n(60604),s=n(50959),a=n(11527),c=(0,i.G)((e,t)=>{let{className:n,...i}=e,{headerId:c,setHeaderMounted:u}=(0,r.vR)();(0,s.useEffect)(()=>(u(!0),()=>u(!1)),[u]);let d=(0,o.cx)("chakra-modal__header",n),p={flex:0,...(0,r.I_)().header};return(0,a.jsx)(l.m.header,{ref:t,className:d,id:c,...i,__css:p})});c.displayName="ModalHeader"},44226:function(e,t,n){"use strict";n.d(t,{h:function(){return x}});var r=n(60604),o=n(35486),i=n(24843),l=n(41843),s=n(63061),a=n(50959),c=n(11527),u={initial:"initial",animate:"enter",exit:"exit",variants:{initial:({offsetX:e,offsetY:t,transition:n,transitionEnd:r,delay:i})=>{var l;return{opacity:0,x:e,y:t,transition:null!=(l=null==n?void 0:n.exit)?l:o.p$.exit(o.Sh.exit,i),transitionEnd:null==r?void 0:r.exit}},enter:({transition:e,transitionEnd:t,delay:n})=>{var r;return{opacity:1,x:0,y:0,transition:null!=(r=null==e?void 0:e.enter)?r:o.p$.enter(o.Sh.enter,n),transitionEnd:null==t?void 0:t.enter}},exit:({offsetY:e,offsetX:t,transition:n,transitionEnd:r,reverse:i,delay:l})=>{var s;let a={x:t,y:e};return{opacity:0,transition:null!=(s=null==n?void 0:n.exit)?s:o.p$.exit(o.Sh.exit,l),...i?{...a,transitionEnd:null==r?void 0:r.exit}:{transitionEnd:{...a,...null==r?void 0:r.exit}}}}}};(0,a.forwardRef)(function(e,t){let{unmountOnExit:n,in:r,reverse:o=!0,className:a,offsetX:d=0,offsetY:p=8,transition:f,transitionEnd:h,delay:y,...m}=e,v=!n||r&&n,x=r||n?"enter":"exit",k={offsetX:d,offsetY:p,reverse:o,transition:f,transitionEnd:h,delay:y};return(0,c.jsx)(l.M,{custom:k,children:v&&(0,c.jsx)(s.E.div,{ref:t,className:(0,i.cx)("chakra-offset-slide",a),custom:k,...u,animate:x,...m})})}).displayName="SlideFade";var d={initial:"exit",animate:"enter",exit:"exit",variants:{exit:({reverse:e,initialScale:t,transition:n,transitionEnd:r,delay:i})=>{var l;return{opacity:0,...e?{scale:t,transitionEnd:null==r?void 0:r.exit}:{transitionEnd:{scale:t,...null==r?void 0:r.exit}},transition:null!=(l=null==n?void 0:n.exit)?l:o.p$.exit(o.Sh.exit,i)}},enter:({transitionEnd:e,transition:t,delay:n})=>{var r;return{opacity:1,scale:1,transition:null!=(r=null==t?void 0:t.enter)?r:o.p$.enter(o.Sh.enter,n),transitionEnd:null==e?void 0:e.enter}}}};(0,a.forwardRef)(function(e,t){let{unmountOnExit:n,in:r,reverse:o=!0,initialScale:a=.95,className:u,transition:p,transitionEnd:f,delay:h,...y}=e,m=!n||r&&n,v=r||n?"enter":"exit",x={initialScale:a,reverse:o,transition:p,transitionEnd:f,delay:h};return(0,c.jsx)(l.M,{custom:x,children:m&&(0,c.jsx)(s.E.div,{ref:t,className:(0,i.cx)("chakra-offset-slide",u),...d,animate:v,custom:x,...y})})}).displayName="ScaleFade";var p={slideInBottom:{...u,custom:{offsetY:16,reverse:!0}},slideInRight:{...u,custom:{offsetX:16,reverse:!0}},slideInTop:{...u,custom:{offsetY:-16,reverse:!0}},slideInLeft:{...u,custom:{offsetX:-16,reverse:!0}},scale:{...d,custom:{initialScale:.95,reverse:!0}},none:{}},f=(0,r.m)(s.E.section),h=e=>p[e||"none"],y=(0,a.forwardRef)((e,t)=>{let{preset:n,motionProps:r=h(n),...o}=e;return(0,c.jsx)(f,{ref:t,...r,...o})});y.displayName="ModalTransition";var m=n(99397),v=n(64933),x=(0,n(94628).G)((e,t)=>{let{className:n,children:o,containerProps:l,motionProps:s,...a}=e,{getDialogProps:u,getDialogContainerProps:d}=(0,v.vR)(),p=u(a,t),f=d(l),h=(0,i.cx)("chakra-modal__content",n),x=(0,v.I_)(),k={display:"flex",flexDirection:"column",position:"relative",width:"100%",outline:0,...x.dialog},_={display:"flex",width:"100vw",height:"$100vh",position:"fixed",left:0,top:0,...x.dialogContainer},{motionPreset:g}=(0,v.vR)();return(0,c.jsx)(m.M,{children:(0,c.jsx)(r.m.div,{...f,className:"chakra-modal__content-container",tabIndex:-1,__css:_,children:(0,c.jsx)(y,{preset:g,motionProps:s,className:h,...p,__css:k,children:o})})})});x.displayName="ModalContent"},81700:function(e,t,n){"use strict";n.d(t,{f:function(){return c}});var r=n(64933),o=n(24843),i=n(94628),l=n(60604),s=n(50959),a=n(11527),c=(0,i.G)((e,t)=>{let{className:n,...i}=e,{bodyId:c,setBodyMounted:u}=(0,r.vR)();(0,s.useEffect)(()=>(u(!0),()=>u(!1)),[u]);let d=(0,o.cx)("chakra-modal__body",n),p=(0,r.I_)();return(0,a.jsx)(l.m.div,{ref:t,className:d,id:c,...i,__css:p.body})});c.displayName="ModalBody"},15123:function(e,t,n){"use strict";n.d(t,{m:function(){return a}});var r=n(64933),o=n(24843),i=n(94628),l=n(60604),s=n(11527),a=(0,i.G)((e,t)=>{let{className:n,...i}=e,a=(0,o.cx)("chakra-modal__footer",n),c={display:"flex",alignItems:"center",justifyContent:"flex-end",...(0,r.I_)().footer};return(0,s.jsx)(l.m.footer,{ref:t,...i,__css:c,className:a})});a.displayName="ModalFooter"},99619:function(e,t,n){"use strict";n.d(t,{y:function(){return p}});var r=n(30683),o=n(60604),i=n(94628),l=n(63061),s=n(11527),a={exit:{opacity:0,scale:.95,transition:{duration:.1,ease:[.4,0,1,1]}},enter:{scale:1,opacity:1,transition:{duration:.15,ease:[0,0,.2,1]}}},c=(0,o.m)(l.E.section),u=(0,i.G)(function(e,t){let{variants:n=a,...o}=e,{isOpen:i}=(0,r.lp)();return(0,s.jsx)(c,{ref:t,variants:function(e){if(e)return{enter:{...e.enter,visibility:"visible"},exit:{...e.exit,transitionEnd:{visibility:"hidden"}}}}(n),initial:!1,animate:i?"enter":"exit",...o})});u.displayName="PopoverTransition";var d=n(24843),p=(0,i.G)(function(e,t){let{rootProps:n,motionProps:i,...l}=e,{getPopoverProps:a,getPopoverPositionerProps:c,onAnimationComplete:p}=(0,r.lp)(),f=(0,r.SV)(),h={position:"relative",display:"flex",flexDirection:"column",...f.content};return(0,s.jsx)(o.m.div,{...c(n),__css:f.popper,className:"chakra-popover__popper",children:(0,s.jsx)(u,{...i,...a(l,t),onAnimationComplete:(0,d.PP)(p,l.onAnimationComplete),className:(0,d.cx)("chakra-popover__content",e.className),__css:h})})});p.displayName="PopoverContent"},5511:function(e,t,n){"use strict";n.d(t,{J:function(){return N}});var r=n(12427),o=n(8658),i=()=>"undefined"!=typeof window,l=e=>i()&&e.test(navigator.vendor),s=e=>i()&&e.test(function(){var e;let t=navigator.userAgentData;return null!=(e=null==t?void 0:t.platform)?e:navigator.platform}()),a=()=>s(/mac|iphone|ipad|ipod/i),c=()=>a()&&l(/apple/i),u=n(5377),d=n(1445),p=n(10998),f=n(51842),h=n(88198),y=n(24843),m=n(59112),v=n(50959),x={click:"click",hover:"hover"};function k(e,t){return e===t||(null==e?void 0:e.contains(t))}function _(e){var t;let n=e.currentTarget.ownerDocument.activeElement;return null!=(t=e.relatedTarget)?t:n}var g=n(30683),w=n(91573),b=n(96741),E=n(9158),C=n(11527);function N(e){let t=(0,w.jC)("Popover",e),{children:n,...i}=(0,b.Lr)(e),l=(0,E.F)(),s=function(e={}){let{closeOnBlur:t=!0,closeOnEsc:n=!0,initialFocusRef:i,id:l,returnFocusOnClose:s=!0,autoFocus:a=!0,arrowSize:g,arrowShadowColor:w,trigger:b=x.click,openDelay:E=200,closeDelay:C=200,isLazy:N,lazyBehavior:j="unmount",computePositionOnMount:K,...O}=e,{isOpen:S,onClose:P,onOpen:T,onToggle:D}=(0,d.q)(e),R=(0,v.useRef)(null),I=(0,v.useRef)(null),M=(0,v.useRef)(null),L=(0,v.useRef)(!1),U=(0,v.useRef)(!1);S&&(U.current=!0);let[A,G]=(0,v.useState)(!1),[B,F]=(0,v.useState)(!1),q=(0,v.useId)(),V=null!=l?l:q,[$,H,W,Y]=["popover-trigger","popover-content","popover-header","popover-body"].map(e=>`${e}-${V}`),{referenceRef:X,getArrowProps:z,getPopperProps:J,getArrowInnerProps:Z,forceUpdate:Q}=(0,p.D)({...O,enabled:S||!!K}),ee=(0,r.h)({isOpen:S,ref:M});!function(e){let{ref:t,elements:n,enabled:r}=e,i=()=>{var e,n;return null!=(n=null==(e=t.current)?void 0:e.ownerDocument)?n:document};(0,o.O)(i,"pointerdown",e=>{if(!c()||!r)return;let o=e.target,l=(null!=n?n:[t]).some(e=>{let t="current"in e?e.current:e;return(null==t?void 0:t.contains(o))||t===o});i().activeElement!==o&&l&&(e.preventDefault(),o.focus())})}({enabled:S,ref:I}),(0,u.C)(M,{focusRef:I,visible:S,shouldFocus:s&&b===x.click}),(0,u.G)(M,{focusRef:i,visible:S,shouldFocus:a&&b===x.click});let et=(0,m.k)({wasSelected:U.current,enabled:N,mode:j,isSelected:ee.present}),en=(0,v.useCallback)((e={},r=null)=>{let o={...e,style:{...e.style,transformOrigin:f.Dq.transformOrigin.varRef,[f.Dq.arrowSize.var]:g?`${g}px`:void 0,[f.Dq.arrowShadowColor.var]:w},ref:(0,h.lq)(M,r),children:et?e.children:null,id:H,tabIndex:-1,role:"dialog",onKeyDown:(0,y.v0)(e.onKeyDown,e=>{n&&"Escape"===e.key&&P()}),onBlur:(0,y.v0)(e.onBlur,e=>{let n=_(e),r=k(M.current,n),o=k(I.current,n);S&&t&&!r&&!o&&P()}),"aria-labelledby":A?W:void 0,"aria-describedby":B?Y:void 0};return b===x.hover&&(o.role="tooltip",o.onMouseEnter=(0,y.v0)(e.onMouseEnter,()=>{L.current=!0}),o.onMouseLeave=(0,y.v0)(e.onMouseLeave,e=>{null!==e.nativeEvent.relatedTarget&&(L.current=!1,setTimeout(()=>P(),C))})),o},[et,H,A,W,B,Y,b,n,P,S,t,C,w,g]),er=(0,v.useCallback)((e={},t=null)=>J({...e,style:{visibility:S?"visible":"hidden",...e.style}},t),[S,J]),eo=(0,v.useCallback)((e,t=null)=>({...e,ref:(0,h.lq)(t,R,X)}),[R,X]),ei=(0,v.useRef)(),el=(0,v.useRef)(),es=(0,v.useCallback)(e=>{null==R.current&&X(e)},[X]),ea=(0,v.useCallback)((e={},n=null)=>{let r={...e,ref:(0,h.lq)(I,n,es),id:$,"aria-haspopup":"dialog","aria-expanded":S,"aria-controls":H};return b===x.click&&(r.onClick=(0,y.v0)(e.onClick,D)),b===x.hover&&(r.onFocus=(0,y.v0)(e.onFocus,()=>{void 0===ei.current&&T()}),r.onBlur=(0,y.v0)(e.onBlur,e=>{let n=_(e),r=!k(M.current,n);S&&t&&r&&P()}),r.onKeyDown=(0,y.v0)(e.onKeyDown,e=>{"Escape"===e.key&&P()}),r.onMouseEnter=(0,y.v0)(e.onMouseEnter,()=>{L.current=!0,ei.current=window.setTimeout(()=>T(),E)}),r.onMouseLeave=(0,y.v0)(e.onMouseLeave,()=>{L.current=!1,ei.current&&(clearTimeout(ei.current),ei.current=void 0),el.current=window.setTimeout(()=>{!1===L.current&&P()},C)})),r},[$,S,H,b,es,D,T,t,P,E,C]);(0,v.useEffect)(()=>()=>{ei.current&&clearTimeout(ei.current),el.current&&clearTimeout(el.current)},[]);let ec=(0,v.useCallback)((e={},t=null)=>({...e,id:W,ref:(0,h.lq)(t,e=>{G(!!e)})}),[W]),eu=(0,v.useCallback)((e={},t=null)=>({...e,id:Y,ref:(0,h.lq)(t,e=>{F(!!e)})}),[Y]);return{forceUpdate:Q,isOpen:S,onAnimationComplete:ee.onComplete,onClose:P,getAnchorProps:eo,getArrowProps:z,getArrowInnerProps:Z,getPopoverPositionerProps:er,getPopoverProps:en,getTriggerProps:ea,getHeaderProps:ec,getBodyProps:eu}}({...i,direction:l.direction});return(0,C.jsx)(g.H2,{value:s,children:(0,C.jsx)(g.WG,{value:t,children:(0,y.Pu)(n,{isOpen:s.isOpen,onClose:s.onClose,forceUpdate:s.forceUpdate})})})}N.displayName="Popover"},59569:function(e,t,n){"use strict";n.d(t,{Y:function(){return a}});var r=n(30683),o=n(94628),i=n(60604),l=n(24843),s=n(11527),a=(0,o.G)(function(e,t){let{getHeaderProps:n}=(0,r.lp)(),o=(0,r.SV)();return(0,s.jsx)(i.m.header,{...n(e,t),className:(0,l.cx)("chakra-popover__header",e.className),__css:o.header})});a.displayName="PopoverHeader"},76174:function(e,t,n){"use strict";n.d(t,{x:function(){return i}});var r=n(30683),o=n(50959);function i(e){let t=o.Children.only(e.children),{getTriggerProps:n}=(0,r.lp)();return(0,o.cloneElement)(t,n(t.props,t.ref))}i.displayName="PopoverTrigger"},12504:function(e,t,n){"use strict";n.d(t,{D:function(){return s}});var r=n(30683),o=n(60604),i=n(24843),l=n(11527);function s(e){let t=(0,r.SV)();return(0,l.jsx)(o.m.footer,{...e,className:(0,i.cx)("chakra-popover__footer",e.className),__css:t.footer})}s.displayName="PopoverFooter"},51558:function(e,t,n){"use strict";n.d(t,{b:function(){return a}});var r=n(30683),o=n(94628),i=n(60604),l=n(24843),s=n(11527),a=(0,o.G)(function(e,t){let{getBodyProps:n}=(0,r.lp)(),o=(0,r.SV)();return(0,s.jsx)(i.m.div,{...n(e,t),className:(0,l.cx)("chakra-popover__body",e.className),__css:o.body})});a.displayName="PopoverBody"},30683:function(e,t,n){"use strict";n.d(t,{H2:function(){return o},SV:function(){return s},WG:function(){return l},lp:function(){return i}});var r=n(41235),[o,i]=(0,r.k)({name:"PopoverContext",errorMessage:"usePopoverContext: `context` is undefined. Seems you forgot to wrap all popover components within `<Popover />`"}),[l,s]=(0,r.k)({name:"PopoverStylesContext",errorMessage:"usePopoverStyles returned is 'undefined'. Seems you forgot to wrap the components in \"<Popover />\" "})},26819:function(e,t,n){"use strict";n.d(t,{P:function(){return p}});var r=n(24843),o=n(94628),i=n(60604),l=n(11527),s=(0,o.G)(function(e,t){let{children:n,placeholder:o,className:s,...a}=e;return(0,l.jsxs)(i.m.select,{...a,ref:t,className:(0,r.cx)("chakra-select",s),children:[o&&(0,l.jsx)("option",{value:"",children:o}),n]})});s.displayName="SelectField";var a=n(15074),c=n(91573),u=n(96741),d=n(50959),p=(0,o.G)((e,t)=>{var n;let o=(0,c.jC)("Select",e),{rootProps:d,placeholder:p,icon:f,color:h,height:m,h:v,minH:x,minHeight:k,iconColor:_,iconSize:g,...w}=(0,u.Lr)(e),[b,E]=function(e,t){let n={},r={};for(let[o,i]of Object.entries(e))t.includes(o)?n[o]=i:r[o]=i;return[n,r]}(w,u.oE),C=(0,a.Y)(E),N={paddingEnd:"2rem",...o.field,_focus:{zIndex:"unset",...null==(n=o.field)?void 0:n._focus}};return(0,l.jsxs)(i.m.div,{className:"chakra-select__wrapper",__css:{width:"100%",height:"fit-content",position:"relative",color:h},...b,...d,children:[(0,l.jsx)(s,{ref:t,height:null!=v?v:m,minH:null!=x?x:k,placeholder:p,...C,__css:N,children:e.children}),(0,l.jsx)(y,{"data-disabled":(0,r.PB)(C.disabled),...(_||h)&&{color:_||h},__css:o.icon,...g&&{fontSize:g},children:f})]})});p.displayName="Select";var f=e=>(0,l.jsx)("svg",{viewBox:"0 0 24 24",...e,children:(0,l.jsx)("path",{fill:"currentColor",d:"M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"})}),h=(0,i.m)("div",{baseStyle:{position:"absolute",display:"inline-flex",alignItems:"center",justifyContent:"center",pointerEvents:"none",top:"50%",transform:"translateY(-50%)"}}),y=e=>{let{children:t=(0,l.jsx)(f,{}),...n}=e,r=(0,d.cloneElement)(t,{role:"presentation",className:"chakra-select__icon",focusable:!1,"aria-hidden":!0,style:{width:"1em",height:"1em",color:"currentColor"}});return(0,l.jsx)(h,{...n,className:"chakra-select__icon-wrapper",children:(0,d.isValidElement)(t)?r:null})};y.displayName="SelectIcon"},95478:function(e,t,n){"use strict";n.d(t,{TX:function(){return i}});var r=n(47389),o=n(60604),i=(0,o.m)("span",{baseStyle:r.N});i.displayName="VisuallyHidden",(0,o.m)("input",{baseStyle:r.N}).displayName="VisuallyHiddenInput"}}]);