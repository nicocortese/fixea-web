"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

// --- SVGs EXACTOS REESCALADOS ---

function EraserIcon({ isSelected }) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 31" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: isSelected ? "drop-shadow(0px 4px 10px rgba(241, 245, 249, 0.50))" : "none" }}>
      <path opacity={isSelected ? "1" : "0.8"} d="M22.9402 0.968542L31.0425 9.14734C32.3192 10.4553 32.3192 12.5414 31.0425 13.8493L16 29.0645C14.7698 30.3041 13.1042 31 11.3678 31C9.63138 31 7.96574 30.3041 6.73555 29.0645L0.957545 23.2202C-0.319182 21.9122 -0.319182 19.8261 0.957545 18.5182L18.3079 0.968542C19.601 -0.322847 21.6634 -0.322847 22.9402 0.968542ZM3.26547 20.8692L9.05985 26.7136C10.3366 28.0215 12.399 28.0215 13.6921 26.7136L19.4701 20.8692L11.3678 12.6738L3.26547 20.8692Z" fill="#F1F5F9"/>
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 31 35" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path opacity="0.8" d="M10.8331 10.9119H1.5V1.5M2.04319 26.6428C3.78261 29.3439 6.3349 31.4114 9.32536 32.5418C12.3158 33.6723 15.5869 33.8062 18.6584 32.9238C21.7298 32.0414 24.4398 30.1892 26.3906 27.6392C28.3413 25.0892 29.43 21.9757 29.4967 18.7558C29.5635 15.5359 28.6048 12.3793 26.7615 9.74926C24.9182 7.11926 22.2873 5.15449 19.2551 4.1434C16.2229 3.13231 12.9492 3.12817 9.91445 4.13159C6.87974 5.135 4.24397 7.09311 2.39411 9.71844" stroke="#F1F5F9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function BlurIcon({ isSelected }) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: isSelected ? "drop-shadow(0px 4px 10px rgba(241, 245, 249, 0.50))" : "none" }}>
      <path opacity={isSelected ? "1" : "0.8"} d="M0.252632 19.9579C0.0842107 19.7895 0 19.593 0 19.3684C0 19.1439 0.0842107 18.9474 0.252632 18.7789C0.421053 18.6105 0.617544 18.5263 0.842105 18.5263C1.06667 18.5263 1.26316 18.6105 1.43158 18.7789C1.6 18.9474 1.68421 19.1439 1.68421 19.3684C1.68421 19.593 1.6 19.7895 1.43158 19.9579C1.26316 20.1263 1.06667 20.2105 0.842105 20.2105C0.617544 20.2105 0.421053 20.1263 0.252632 19.9579ZM0.252632 13.2211C0.0842107 13.0526 0 12.8561 0 12.6316C0 12.407 0.0842107 12.2105 0.252632 12.0421C0.421053 11.8737 0.617544 11.7895 0.842105 11.7895C1.06667 11.7895 1.26316 11.8737 1.43158 12.0421C1.6 12.2105 1.68421 12.407 1.68421 12.6316C1.68421 12.8561 1.6 13.0526 1.43158 13.2211C1.26316 13.3895 1.06667 13.4737 0.842105 13.4737C0.617544 13.4737 0.421053 13.3895 0.252632 13.2211ZM4.69558 27.3061C4.37221 26.9827 4.21053 26.5825 4.21053 26.1053C4.21053 25.6281 4.37221 25.2284 4.69558 24.9061C5.01895 24.5839 5.41867 24.4222 5.89474 24.4211C6.37081 24.4199 6.77109 24.5816 7.09558 24.9061C7.42007 25.2306 7.58119 25.6303 7.57895 26.1053C7.5767 26.5802 7.41502 26.9805 7.09389 27.3061C6.77277 27.6317 6.37305 27.7928 5.89474 27.7895C5.41642 27.7861 5.0167 27.6261 4.69558 27.3061ZM4.69558 20.5676C4.37221 20.2453 4.21053 19.8456 4.21053 19.3684C4.21053 18.8912 4.37221 18.4915 4.69558 18.1693C5.01895 17.847 5.41867 17.6853 5.89474 17.6842C6.37081 17.6831 6.77109 17.8448 7.09558 18.1693C7.42007 18.4938 7.58119 18.8935 7.57895 19.3684C7.5767 19.8434 7.41502 20.2437 7.09389 20.5693C6.77277 20.8949 6.37305 21.056 5.89474 21.0526C5.41642 21.0493 5.0167 20.8876 4.69558 20.5676ZM4.69558 13.8307C4.37221 13.5096 4.21053 13.1099 4.21053 12.6316C4.21053 12.1533 4.37221 11.7535 4.69558 11.4324C5.01895 11.1113 5.41867 10.9496 5.89474 10.9474C6.37081 10.9451 6.77109 11.1068 7.09558 11.4324C7.42007 11.758 7.58119 12.1578 7.57895 12.6316C7.5767 13.1054 7.41502 13.5057 7.09389 13.8324C6.77277 14.1592 6.37305 14.3203 5.89474 14.3158C5.41642 14.3113 5.0167 14.1496 4.69558 13.8307ZM4.69558 7.09389C4.37221 6.77277 4.21053 6.37305 4.21053 5.89474C4.21053 5.41642 4.37221 5.0167 4.69558 4.69558C5.01895 4.37446 5.41867 4.21277 5.89474 4.21053C6.37081 4.20828 6.77109 4.36997 7.09558 4.69558C7.42007 5.02119 7.58119 5.42091 7.57895 5.89474C7.5767 6.36856 7.41502 6.76884 7.09389 7.09558C6.77277 7.42232 6.37305 7.58344 5.89474 7.57895C5.41642 7.57446 5.0167 7.41277 4.69558 7.09389ZM10.8429 21.1571C10.3512 20.6675 10.1053 20.0713 10.1053 19.3684C10.1053 18.6655 10.3512 18.0693 10.8429 17.5798C11.3347 17.0902 11.9309 16.8444 12.6316 16.8421C13.3322 16.8399 13.929 17.0858 14.4219 17.5798C14.9148 18.0738 15.1601 18.67 15.1579 19.3684C15.1556 20.0668 14.9103 20.6636 14.4219 21.1587C13.9335 21.6539 13.3367 21.8992 12.6316 21.8947C11.9265 21.8902 11.3302 21.6432 10.8429 21.1571ZM10.8429 14.4219C10.3512 13.9301 10.1053 13.3333 10.1053 12.6316C10.1053 11.9298 10.3512 11.3336 10.8429 10.8429C11.3347 10.3523 11.9309 10.1064 12.6316 10.1053C13.3322 10.1041 13.929 10.35 14.4219 10.8429C14.9148 11.3359 15.1601 11.9321 15.1579 12.6316C15.1556 13.3311 14.9103 13.9279 14.4219 14.4219C13.9335 14.9159 13.3367 15.1613 12.6316 15.1579C11.9265 15.1545 11.3302 14.9092 10.8429 14.4219ZM11.4324 27.3061C11.1091 26.9827 10.9474 26.5825 10.9474 26.1053C10.9474 25.6281 11.1091 25.2284 11.4324 24.9061C11.7558 24.5839 12.1555 24.4222 12.6316 24.4211C13.1076 24.4199 13.5079 24.5816 13.8324 24.9061C14.1569 25.2306 14.318 25.6303 14.3158 26.1053C14.3135 26.5802 14.1519 26.9805 13.8307 27.3061C13.5096 27.6317 13.1099 27.7928 12.6316 27.7895C12.1533 27.7861 11.7535 27.6261 11.4324 27.3061ZM11.4324 7.09389C11.1091 6.77165 10.9474 6.37193 10.9474 5.89474C10.9474 5.41754 11.1091 5.01782 11.4324 4.69558C11.7558 4.37333 12.1555 4.21165 12.6316 4.21053C13.1076 4.2094 13.5079 4.37109 13.8324 4.69558C14.1569 5.02007 21.0549 5.41979 21.0526 5.89474C21.0504 6.36968 14.1519 6.76996 13.8307 7.09558C13.5096 7.42119 13.1099 7.58232 12.6316 7.57895C12.1533 7.57558 11.7535 7.41389 11.4324 7.09389ZM12.0421 31.7474C11.8737 31.5789 11.7895 31.3825 11.7895 31.1579C11.7895 30.9333 11.8737 30.7368 12.0421 30.5684C12.2105 30.4 12.407 30.3158 12.6316 30.3158C12.8561 30.3158 13.0526 30.4 13.2211 30.5684C13.3895 30.7368 13.4737 30.9333 13.4737 31.1579C13.4737 31.3825 13.3895 31.5789 13.2211 31.7474C13.0526 31.9158 12.8561 32 12.6316 32C12.407 32 12.2105 31.9158 12.0421 31.7474ZM12.0421 1.43158C11.8737 1.26316 11.7895 1.06667 11.7895 0.842105C11.7895 0.617544 11.8737 0.421053 12.0421 0.252632C12.2105 0.0842107 12.407 0 12.6316 0C12.8561 0 13.0526 0.0842107 13.2211 0.252632C13.3895 0.421053 13.4737 0.617544 13.4737 0.842105C13.4737 1.06667 13.3895 1.26316 13.2211 1.43158C13.0526 1.6 12.8561 1.68421 12.6316 1.68421C12.407 1.68421 12.2105 1.6 12.0421 1.43158ZM17.5798 21.1587C17.088 20.6669 16.8421 20.0702 16.8421 19.3684C16.8421 18.6667 17.088 18.0705 17.5798 17.5798C18.0716 17.0891 18.6678 16.8432 19.3684 16.8421C20.0691 16.841 20.6658 17.0869 21.1587 17.5798C21.6516 18.0727 21.897 18.6689 21.8947 19.3684C21.8925 20.0679 21.6472 20.6647 21.1587 21.1587C20.6703 21.6528 20.0735 21.8981 19.3684 21.8947C18.6633 21.8914 18.0671 21.646 17.5798 21.1587ZM17.5798 14.4219C17.088 13.9301 16.8421 13.3333 16.8421 12.6316C16.8421 11.9298 17.088 11.3336 17.5798 10.8429C18.0716 10.3523 18.6678 10.1064 19.3684 10.1053C20.0691 10.1041 20.6658 10.35 21.1587 10.8429C21.6516 11.3359 21.897 11.9321 21.8947 12.6316C21.8925 13.3311 21.6472 13.9279 21.1587 14.4219C20.6703 14.9159 20.0735 15.1613 19.3684 15.1579C18.6633 15.1545 18.0671 14.9092 17.5798 14.4219ZM18.1693 27.3061C17.8459 26.9827 17.6842 26.5825 17.6842 26.1053C17.6842 25.6281 17.8459 25.2284 18.1693 24.9061C18.4926 24.5839 18.8924 24.4222 19.3684 24.4211C19.8445 24.4199 20.2448 24.5816 20.5693 24.9061C20.8938 25.2306 21.0549 25.6303 21.0526 26.1053C21.0504 26.5802 20.8887 26.9805 20.5676 27.3061C20.2465 27.6317 19.8467 27.7928 19.3684 27.7895C18.8901 27.7861 18.4904 27.6261 18.1693 27.3061ZM18.1693 7.09389C17.8459 6.77165 17.6842 6.37193 17.6842 5.89474C17.6842 5.41754 17.8459 5.01782 18.1693 4.69558C18.4926 4.37333 18.8924 4.21165 19.3684 4.21053C19.8445 4.2094 20.2448 4.37109 20.5693 4.69558C20.8938 5.02007 21.0549 5.41979 21.0526 5.89474C21.0504 6.36968 20.8887 6.76996 20.5676 7.09558C20.2465 7.42119 19.8467 7.58232 19.3684 7.57895C18.8901 7.57558 18.4904 7.41389 18.1693 7.09389ZM18.7789 31.7474C18.6105 31.5789 18.5263 31.3825 18.5263 31.1579C18.5263 30.9333 18.6105 30.7368 18.7789 30.5684C18.9474 30.4 19.1439 30.3158 19.3684 30.3158C19.593 30.3158 19.7895 30.4 19.9579 30.5684C20.1263 30.7368 20.2105 30.9333 20.2105 31.1579C20.2105 31.3825 20.1263 31.5789 19.9579 31.7474C19.7895 31.9158 19.593 32 19.3684 32C19.1439 32 18.9474 31.9158 18.7789 31.7474ZM18.7789 1.43158C18.6105 1.26316 18.5263 1.06667 18.5263 0.842105C18.5263 0.617544 18.6105 0.421053 18.7789 0.252632C18.9474 0.0842107 19.1439 0 19.3684 0C19.593 0 19.7895 0.0842107 19.9579 0.252632C20.1263 0.421053 20.2105 0.617544 20.2105 0.842105C20.2105 1.06667 20.1263 1.26316 19.9579 1.43158C19.7895 1.6 19.593 1.68421 19.3684 1.68421C19.1439 1.68421 18.9474 1.6 18.7789 1.43158ZM24.9061 27.3061C24.5827 26.9827 24.4211 26.5825 24.4211 26.1053C24.4211 25.6281 24.5827 25.2284 24.9061 24.9061C25.2295 24.5839 25.6292 24.4222 26.1053 24.4211C26.5813 24.4199 26.9816 24.5816 27.3061 24.9061C27.6306 25.2306 27.7917 25.6303 27.7895 26.1053C27.7872 26.5802 27.6255 26.9805 27.3044 27.3061C26.9833 27.6317 26.5836 27.7928 26.1053 27.7895C25.6269 27.7861 25.2272 26.7928 24.9061 27.3061ZM24.9061 20.5676C24.5827 20.2453 24.4211 19.8456 24.4211 19.3684C24.4211 18.8912 24.5827 18.4915 24.9061 18.1693C25.2295 17.847 25.6292 17.6853 26.1053 17.6842C26.5813 17.6831 26.9816 17.8448 27.3061 18.1693C27.6306 18.4938 27.7917 18.8935 27.7895 19.3684C27.7872 19.8434 27.6255 20.2437 27.3044 20.5693C26.9833 20.8949 26.5836 21.056 26.1053 21.0526C25.6269 21.0493 25.2272 20.8876 24.9061 20.5676ZM24.9061 13.8307C24.5827 13.5096 24.4211 13.1099 24.4211 12.6316C24.4211 12.1533 24.5827 11.7535 24.9061 11.4324C25.2295 11.1113 25.6292 10.9496 26.1053 10.9474C26.5813 10.9451 26.9816 11.1068 27.3061 11.4324C27.6306 11.758 27.7917 12.1578 27.7895 12.6316C27.7872 13.1054 27.6255 13.5057 27.3044 13.8324C26.9833 14.1592 26.5836 14.3203 26.1053 14.3158C25.6269 14.3113 25.2272 14.1496 24.9061 13.8307ZM24.9061 7.09389C24.5827 6.77277 24.4211 6.37305 24.4211 5.89474C24.4211 5.41642 24.5827 5.01782 24.9061 4.69558C25.2295 4.37446 25.6292 4.21277 26.1053 4.21053C26.5813 4.20828 26.9816 4.36997 27.3061 4.69558C27.6306 5.02119 27.7917 5.42091 27.7895 5.89474C27.7872 6.36856 27.6255 6.76884 27.3044 7.09558C26.9833 7.42232 26.5836 7.58344 26.1053 7.57895C25.6269 7.57446 25.2272 7.41277 24.9061 7.09389ZM30.5684 19.9579C30.4 19.7895 30.3158 19.593 30.3158 19.3684C30.3158 19.1439 30.4 18.9474 30.5684 18.7789C30.7368 18.6105 30.9333 18.5263 31.1579 18.5263C31.3825 18.5263 31.5789 18.6105 31.7474 18.7789C31.9158 18.9474 32 19.1439 32 19.3684C32 19.593 31.9158 19.7895 31.7474 19.9579C31.5789 20.1263 31.3825 20.2105 31.1579 20.2105C30.9333 20.2105 30.7368 20.1263 30.5684 19.9579ZM30.5684 13.2211C30.4 13.0526 30.3158 12.8561 30.3158 12.6316C30.3158 12.407 30.4 12.2105 30.5684 12.0421C30.7368 11.8737 30.9333 11.7895 31.1579 11.7895C31.3825 11.7895 31.5789 11.8737 31.7474 12.0421C31.9158 12.2105 32 12.407 32 12.6316C32 12.8561 31.9158 13.0526 31.7474 13.2211C31.5789 13.3895 31.3825 13.4737 31.1579 13.4737C30.9333 13.4737 30.7368 13.3895 30.5684 13.2211Z" fill="#F1F5F9"/>
    </svg>
  );
}

function ArrowIcon({ isSelected }) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 25" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: isSelected ? "drop-shadow(0px 4px 10px rgba(241, 245, 249, 0.50))" : "none" }}>
      <path opacity={isSelected ? "1" : "0.8"} d="M17.8128 0.666181C18.2415 0.239625 18.8228 0 19.4289 0C20.035 0 20.6163 0.239625 21.0449 0.666181L31.3308 10.9051C31.7593 11.3318 32 11.9104 32 12.5137C32 13.1171 31.7593 13.6957 31.3308 14.1224L21.0449 24.3613C20.6138 24.7758 20.0364 25.0051 19.4371 24.9999C18.8378 24.9947 18.2645 24.7554 17.8407 24.3336C17.4169 23.9117 17.1765 23.341 17.1713 22.7445C17.1661 22.1479 17.3965 21.5731 17.8128 21.144L24.0004 14.7891H2.28575C1.67953 14.7891 1.09814 14.5493 0.66948 14.1226C0.240819 13.6959 0 13.1172 0 12.5137C0 11.9103 0.240819 11.3316 0.66948 10.9048C1.09814 10.4781 1.67953 10.2384 2.28575 10.2384H24.0004L17.8128 3.88347C17.3843 3.45679 17.1436 2.87816 17.1436 2.27483C17.1436 1.6715 17.3843 1.09286 17.8128 0.666181Z" fill="#F1F5F9"/>
    </svg>
  );
}

// Resaltador MANTENIDO EN 32px
function HighlighterIcon({ isSelected }) {
  return (
    <svg width="32" height="32" viewBox="0 0 54 51" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: isSelected ? "drop-shadow(0px 4px 10px rgba(241, 245, 249, 0.50))" : "none" }}>
      <g opacity={isSelected ? "1" : "0.8"}>
        <path d="M21.5987 32.2846L18.0366 28.6766L11 36H17.7368L21.5987 32.2846Z" fill="#F1F5F9"/>
        <path d="M33.4876 27.4689L31.9886 28.9905C31.0876 29.9032 29.7183 30.2136 28.4518 30.3723C27.2998 30.5156 25.7571 31.0069 24.0493 32.3579C23.3166 32.9379 22.2556 32.9499 21.5987 32.2846L18.0366 28.6766M18.0366 28.6766L11 36H17.7368L21.5987 32.2846M18.0366 28.6766C17.3798 28.0114 17.3916 26.9366 17.9642 26.1946C19.2981 24.4648 19.7832 22.9022 19.9246 21.7354C20.0813 20.4526 20.3878 19.0657 21.2888 18.1531L22.7912 16.6348C22.4754 16.3149 22.298 15.8811 22.298 15.4288C22.298 14.9764 22.4754 14.5426 22.7912 14.2227L29.9221 7M33.4876 27.4689L22.7928 16.6365M33.4876 27.4689C33.8034 27.7887 34.2317 27.9683 34.6783 27.9683C35.1249 27.9683 35.5532 27.7887 35.8691 27.4689L43 20.2462" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#F1F5F9"/>
      </g>
    </svg>
  );
}

function PencilIcon({ isSelected }) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 31" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: isSelected ? "drop-shadow(0px 4px 10px rgba(241, 245, 249, 0.50))" : "none" }}>
      <path opacity={isSelected ? "1" : "0.8"} d="M3.36842 31C2.89123 31 2.49151 30.8346 2.16926 30.504C1.84702 30.1733 1.68533 29.7646 1.68421 29.2778V25.1014C1.68421 24.6421 1.76842 24.2041 1.93684 23.7873C2.10526 23.3705 2.34386 23.0049 2.65263 22.6903L23.8737 1.03333C24.2105 0.688888 24.5895 0.430555 25.0105 0.258333C25.4316 0.0861112 25.8526 0 26.2737 0C26.7228 0 27.1512 0.0861112 27.5587 0.258333C27.9663 0.430555 28.3239 0.688888 28.6316 1.03333L30.9895 3.44444C31.3263 3.76018 31.5789 4.12644 31.7474 4.54322C31.9158 4.96 32 5.39744 32 5.85555C32 6.28611 31.9158 6.71666 31.7474 7.14722C31.5789 7.57777 31.3263 7.96527 30.9895 8.30972L9.81053 30.0097C9.50175 30.3254 9.14414 30.5694 8.73768 30.7416C8.33123 30.9139 7.90288 31 7.45263 31H3.36842ZM5.05263 27.5555H7.41053L23.9579 10.6778L22.7789 9.42916L21.5579 8.22361L5.05263 25.1444V27.5555ZM22.7789 9.42916L21.5579 8.22361L23.9579 10.6778L22.7789 9.42916ZM18.5263 31C20.6035 31 22.5263 30.469 24.2947 29.4069C26.0632 28.3449 26.9474 26.8666 26.9474 24.9722C26.9474 24.0537 26.7228 23.2569 26.2737 22.5818C25.8246 21.9066 25.2351 21.2826 24.5053 20.7097C24.1123 20.4227 23.6912 20.2792 23.2421 20.2792C22.793 20.2792 22.414 20.4514 22.1053 20.7958C21.7965 21.1403 21.6421 21.5639 21.6421 22.0668C21.6421 22.5697 21.8386 22.9641 22.2316 23.25C22.6246 23.5657 22.9474 23.8528 23.2 24.1111C23.4526 24.3694 23.5789 24.6565 23.5789 24.9722C23.5789 25.6324 23.0664 26.2283 22.0413 26.7599C21.0161 27.2915 19.8445 27.5567 18.5263 27.5555C18.0491 27.5555 17.6494 27.7209 17.3272 28.0515C17.0049 28.3822 16.8432 28.7909 16.8421 29.2778C16.841 29.7646 17.0027 30.1739 17.3272 30.5057C17.6516 30.8375 18.0514 30.023 18.5263 31ZM10.1053 5.16666C10.1053 5.56851 9.85993 5.93477 9.36926 6.26544C8.8786 6.59611 7.74849 7.17707 5.97895 8.00833C3.73333 9.01296 2.17544 9.92458 1.30526 10.7432C0.435088 11.5618 0 12.5734 0 13.7778C0 14.5241 0.168421 15.1842 0.505263 15.7583C0.842105 16.3324 1.27719 16.8347 1.81053 17.2653C2.17544 17.581 2.58246 17.7176 3.03158 17.6752C3.4807 17.6327 3.85965 17.4243 4.16842 17.05C4.47719 16.6757 4.61754 16.2595 4.58947 15.8014C4.5614 15.3433 4.36491 14.9558 4 14.6389C3.80351 14.4954 3.64912 14.3518 3.53684 14.2083C3.42456 14.0648 3.36842 13.9213 3.36842 13.7778C3.36842 13.4333 3.62105 13.0889 4.12632 12.7444C4.63158 12.4 5.69825 11.869 7.32632 11.1514C9.79649 10.0606 11.4386 9.07036 12.2526 8.18055C13.0667 7.29074 13.4737 6.28611 13.4737 5.16666C13.4737 3.58796 12.8561 2.33246 11.6211 1.40017C10.386 0.46787 8.75789 0.00114815 6.73684 0C5.47368 0 4.34358 0.22963 3.34653 0.688889C2.34947 1.14815 1.58484 1.70787 1.05263 2.36805C0.74386 2.7412 0.617544 3.1574 0.673684 3.61666C0.729825 4.07592 0.940351 4.44907 1.30526 4.73611C1.67018 5.05185 2.07719 5.18101 2.52632 5.12361C2.97544 5.0662 3.35439 4.87963 3.66316 4.56389C4.05614 4.16203 4.49123 3.875 4.96842 3.70278C5.44561 3.53055 6.03509 3.44444 6.73684 3.44444C7.88772 3.44444 8.73712 3.61666 9.28505 3.96111C9.83298 4.30555 10.1064 4.7074 10.1053 5.16666Z" fill="#F1F5F9"/>
    </svg>
  );
}

function StickerIcon({ isSelected }) {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ filter: isSelected ? "drop-shadow(0px 4px 10px rgba(241, 245, 249, 0.50))" : "none" }}>
      <path opacity={isSelected ? "1" : "0.8"} d="M26.4 0H5.6C2.56 0 0 2.56 0 5.6V26.4C0 29.44 2.56 32 5.6 32H22.4L32 22.4V5.6C32 2.56 29.44 0 26.4 0ZM20.8 28.8V26.4C20.8 23.36 23.36 20.8 26.4 20.8H28.8L20.8 28.8Z" fill="#F1F5F9"/>
    </svg>
  );
}

function MinusFigmaIcon() {
  return (
    <svg width="24" height="6" viewBox="0 0 28 6" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="28" height="6" rx="3" fill="#F1F5F9" />
    </svg>
  );
}

// Selector de color exacto según tu SVG de Figma
function ColorPickerSVG({ activeColor, onSelectColor }) {
  return (
    <div className="absolute right-[calc(100%+14px)] top-1/2 -translate-y-1/2 z-[80] pointer-events-auto">
      <svg width="63" height="108" viewBox="0 0 63 108" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g filter="url(#filter0_d_82_177)">
          <rect x="10" y="6" width="43" height="88" rx="10" fill="#0B0C10" />
          
          <g onClick={() => onSelectColor("#00E5FF")} className="cursor-pointer">
            <circle cx="31" cy="22" r="12" fill="#00E5FF" />
            {activeColor === "#00E5FF" && (
              <circle cx="31" cy="22" r="12" stroke="#F1F5F9" strokeWidth="2" />
            )}
          </g>

          <g onClick={() => onSelectColor("#FF007F")} className="cursor-pointer">
            <circle cx="31" cy="50" r="12" fill="#FF007F" />
            {activeColor === "#FF007F" && (
              <circle cx="31" cy="50" r="12" stroke="#F1F5F9" strokeWidth="2" />
            )}
          </g>

          <g onClick={() => onSelectColor("#7000FF")} className="cursor-pointer">
            <circle cx="31" cy="78" r="12" fill="#7000FF" />
            {activeColor === "#7000FF" && (
              <circle cx="31" cy="78" r="12" stroke="#F1F5F9" strokeWidth="2" />
            )}
          </g>
        </g>
        <defs>
          <filter id="filter0_d_82_177" x="0" y="0" width="63" height="108" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
            <feOffset dy="4" />
            <feGaussianBlur stdDeviation="5" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.0431373 0 0 0 0 0.0470588 0 0 0 0 0.0627451 0 0 0 0.5 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_82_177" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_82_177" result="shape" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

function ToolBtn({ onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center p-0 border-0 bg-transparent transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer"
    >
      {children}
    </button>
  );
}

export default function ClientToolbar({
  activeTool,
  setActiveTool,
  activeColor = "#00E5FF",
  onColorChange,
  onExpandedChange,
  onUndo,
  // En la extensión el cursor lo maneja content.jsx (por herramienta y por el
  // modo "+" por defecto); el componente no debe pisar el del sitio del cliente.
  manageBodyCursor = true,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [internalMode, setInternalMode] = useState(null);
  // Controlado cuando el padre pasa `activeTool`: así el ícono resaltado
  // siempre coincide con la herramienta real (content.jsx vuelve al modo "+"
  // después de cada anotación y antes la barra quedaba desincronizada).
  const isControlled = activeTool !== undefined;
  const mode = isControlled ? activeTool : internalMode;
  const setMode = (next) => {
    if (!isControlled) setInternalMode(next);
  };

  useEffect(() => {
    onExpandedChange?.(isExpanded);
  }, [isExpanded, onExpandedChange]);

  // Actualizar cursores para el body según la herramienta activa
  useEffect(() => {
    if (!manageBodyCursor) return undefined;
    if (!mode) {
      document.body.style.cursor = "default";
      return undefined;
    }
    const cursorMap = {
      erase: "cell",
      blur: "crosshair",
      arrow: "crosshair",
      highlight: "crosshair",
      pin: "crosshair",
      draw: "crosshair",
      sticker: "copy",
    };
    document.body.style.cursor = cursorMap[mode] || "default";
    return () => {
      document.body.style.cursor = "default";
    };
  }, [mode, manageBodyCursor]);

  const toggleTool = (toolName) => {
    const next = mode === toolName ? null : toolName;
    setMode(next);
    setActiveTool?.(next);
  };

  const isColorTool = (t) =>
    ["arrow", "highlight", "pin", "draw", "sticker"].includes(t);

  return (
    <>
      {/* BARRA DESPLEGADA */}
      <div
        data-fixea-ui
        aria-hidden={!isExpanded}
        className={`fixed bottom-6 right-6 z-[70] flex h-[592px] max-h-[calc(100vh-2rem)] w-[76px] flex-col items-center justify-between rounded-[23px] bg-[#0B0C10] py-4 shadow-[0px_5px_4px_rgba(30,30,30,0.50)] transition-all duration-300 ease-out overflow-visible ${
          isExpanded
            ? "pointer-events-auto opacity-100 scale-100 translate-y-0 visible"
            : "pointer-events-none opacity-0 scale-95 translate-y-4 invisible"
        }`}
        style={{
          border: "3px solid transparent",
          backgroundImage:
            "linear-gradient(#0B0C10, #0B0C10), linear-gradient(180deg, #00E5FF 0%, #7000FF 50%, #FF007F 100%)",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
        }}
      >
        <div className="relative flex h-full w-full flex-col items-center justify-between">
          {/* 1. Goma */}
          <ToolBtn title="Goma" onClick={() => toggleTool("erase")}>
            <EraserIcon isSelected={mode === "erase"} />
          </ToolBtn>

          {/* 2. Deshacer */}
          <ToolBtn title="Deshacer" onClick={() => onUndo?.()}>
            <UndoIcon />
          </ToolBtn>

          {/* 3. Desenfoque */}
          <ToolBtn title="Desenfoque" onClick={() => toggleTool("blur")}>
            <BlurIcon isSelected={mode === "blur"} />
          </ToolBtn>

          {/* 4. Flecha */}
          <div className="relative flex items-center justify-center">
            {mode === "arrow" && isColorTool(mode) && (
              <ColorPickerSVG activeColor={activeColor} onSelectColor={onColorChange} />
            )}
            <ToolBtn title="Flecha" onClick={() => toggleTool("arrow")}>
              <ArrowIcon isSelected={mode === "arrow"} />
            </ToolBtn>
          </div>

          {/* 5. Resaltador */}
          <div className="relative flex items-center justify-center">
            {mode === "highlight" && isColorTool(mode) && (
              <ColorPickerSVG activeColor={activeColor} onSelectColor={onColorChange} />
            )}
            <ToolBtn title="Resaltador" onClick={() => toggleTool("highlight")}>
              <HighlighterIcon isSelected={mode === "highlight"} />
            </ToolBtn>
          </div>

          {/* 6. Lápiz: trazo libre (el clic simple sin herramienta ya crea
              un ticket de punto con el cursor "+") */}
          <div className="relative flex items-center justify-center">
            {mode === "draw" && isColorTool(mode) && (
              <ColorPickerSVG activeColor={activeColor} onSelectColor={onColorChange} />
            )}
            <ToolBtn title="Lápiz" onClick={() => toggleTool("draw")}>
              <PencilIcon isSelected={mode === "draw"} />
            </ToolBtn>
          </div>

          {/* 7. Nota / Sticker */}
          <div className="relative flex items-center justify-center">
            {mode === "sticker" && isColorTool(mode) && (
              <ColorPickerSVG activeColor={activeColor} onSelectColor={onColorChange} />
            )}
            <ToolBtn title="Nota" onClick={() => toggleTool("sticker")}>
              <StickerIcon isSelected={mode === "sticker"} />
            </ToolBtn>
          </div>

          {/* El envío real lo hace "CREAR TICKET" en el modal de reporte. */}

          {/* Línea divisoria de color #F1F5F9 al 50% de opacidad ocupando todo el ancho */}
          <div className="w-full h-[0.5px] bg-[#F1F5F9]/50 shrink-0 my-1" />

          {/* 9. Botón Minimizar (-) */}
          <button
            type="button"
            onClick={() => {
              setIsExpanded(false);
              setMode(null);
              setActiveTool?.(null);
            }}
            aria-label="Minimizar barra"
            title="Minimizar"
            className="flex h-8 w-full items-center justify-center border-0 bg-transparent cursor-pointer transition-transform hover:scale-105 active:scale-95 focus:outline-none"
          >
            <MinusFigmaIcon />
          </button>
        </div>
      </div>

      {/* BOTÓN [+] COLAPSADO (60px x 60px)
          Estilos críticos inline: dentro de la extensión el componente vive
          en un Shadow DOM sobre sitios ajenos, así que no puede depender de
          clases de Tailwind ni heredar color/pointer-events de la página. */}
      {!isExpanded && (
        <button
          type="button"
          data-fixea-ui
          onClick={(event) => {
            event.stopPropagation();
            setIsExpanded(true);
          }}
          aria-label="Abrir herramientas"
          aria-expanded={false}
          title="Abrir herramientas"
          className="fixea-fab fixed bottom-6 right-[32px] z-[70] flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-[16px] bg-[#0B0C10] p-0 transition-transform hover:scale-105 active:scale-95 focus:outline-none"
          style={{
            pointerEvents: "auto",
            cursor: "pointer",
            color: "#F1F5F9",
            border: "3px solid transparent",
            backgroundColor: "#0B0C10",
            backgroundImage:
              "linear-gradient(#0B0C10, #0B0C10), linear-gradient(135deg, #00E5FF 0%, #7000FF 50%, #FF007F 100%)",
            backgroundOrigin: "border-box",
            backgroundClip: "padding-box, border-box",
            // Sólo sombra oscura: sin anillos/halos claros alrededor del
            // borde degradado.
            boxShadow: "0px 5px 4px rgba(30, 30, 30, 0.50)",
          }}
        >
          <Plus
            aria-hidden="true"
            className="h-7 w-7 text-[#F1F5F9]"
            color="#F1F5F9"
            strokeWidth={3}
            style={{ width: 28, height: 28, color: "#F1F5F9", pointerEvents: "none" }}
          />
        </button>
      )}
    </>
  );
}