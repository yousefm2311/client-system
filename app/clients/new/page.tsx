// "use client";

// import {
//   DOC_TYPES,
//   OTHER_DOC_TYPE,
//   correctDocName,
//   extractFileUrl,
//   normalizeDocName,
//   renameFileWithClientCode,
// } from "@/lib/documents";
// import { useEffect, useMemo, useState } from "react";
// import { useRouter } from "next/navigation";
// import { canAccessUploadPage } from "@/lib/access";

// type DocRowState = {
//   key: string;
//   docId?: string;
//   docType: string;
//   customName: string;
//   docDate: string;
//   file?: File;
//   fileLabel?: string;
//   existingPath?: string;
// };

// type ExistingDoc = {
//   DocId: string;
//   DocName: string;
//   DocDate?: string | null;
//   FilePath?: string;
// };

// const makeId = () =>
//   typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
//     ? crypto.randomUUID()
//     : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// const matchDocType = (name: string) => {
//   const normalized = normalizeDocName(name);
//   return DOC_TYPES.find((t) => normalizeDocName(t) === normalized);
// };

// export default function NewClientPage() {
//   const router = useRouter();
//   const [allowed, setAllowed] = useState<boolean | null>(null);
//   const [clientCode, setClientCode] = useState("");
//   const [clientName, setClientName] = useState("");
//   const [isExisting, setIsExisting] = useState(false);
//   const [canEdit, setCanEdit] = useState(true);
//   const [message, setMessage] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [docs, setDocs] = useState<DocRowState[]>([]);

//   useEffect(() => {
//     setDocs([{ key: makeId(), docType: "", customName: "", docDate: "" }]);
//   }, []);

//   // التحقق من الصلاحيات: يسمح فقط للموظفين 3425 أو 403 مع JobCode = 86
//   useEffect(() => {
//     const checkAccess = async () => {
//       try {
//         const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
//         if (!res.ok) {
//           setAllowed(false);
//           return;
//         }
//         const data = await res.json().catch(() => ({}));
//         const userData = data?.user ?? data;
//         const isAllowed = canAccessUploadPage(userData);
//         setAllowed(isAllowed);
//         if (!isAllowed) {
//           setMessage("غير مصرح لك بفتح هذه الصفحة.");
//           // يمكن تحويله لصفحة أخرى إذا لزم الأمر
//           // router.replace("/home");
//         }
//       } catch {
//         setAllowed(false);
//       }
//     };
//     checkAccess();
//   }, [router]);

//   const addRow = () => {
//     setDocs((prev) => [...prev, { key: makeId(), docType: "", customName: "", docDate: "" }]);
//   };

//   const removeRowLocal = (key: string, allowEmpty = false) => {
//     setDocs((prev) => {
//       const next = prev.filter((d) => d.key !== key);
//       if (next.length === 0 && !allowEmpty) {
//         return [{ key: makeId(), docType: "", customName: "", docDate: "" }];
//       }
//       return next;
//     });
//   };

//   const updateRow = (key: string, patch: Partial<DocRowState>) => {
//     setDocs((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
//   };

//   const loadClient = async () => {
//     if (!clientCode.trim()) return;
//     setLoading(true);
//     setMessage("");
//     setCanEdit(true);
//     try {
//       const res = await fetch(`/api/clients?code=${encodeURIComponent(clientCode.trim())}`, {
//         credentials: "include",
//       });
//       if (!res.ok) throw new Error("تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.");
//       const data = await res.json().catch(() => ({}));

//       if (data?.client) {
//         const unauthorized = data.unauthorized;
//         setIsExisting(!unauthorized);
//         setClientName(data.client.clientName || "");
//         if (unauthorized) {
//           setMessage(data.denyReason || "هذا العميل مسجّل بفرع آخر ولا تملك صلاحية التعديل.");
//           setCanEdit(false);
//           setDocs([]);
//           return;
//         }
//       } else {
//         setIsExisting(false);
//         setClientName("");
//         setMessage("العميل غير موجود، سيتم إنشاؤه عند الحفظ.");
//       }

//       const docsRes = await fetch(`/api/clients/${clientCode.trim()}`, {
//         credentials: "include",
//       });
//       if (!docsRes.ok) throw new Error("تعذر جلب مستندات العميل، حاول مرة أخرى.");
//       const docsData = await docsRes.json().catch(() => ({}));

//       if (docsData.unauthorized) {
//         setMessage(docsData.denyReason || "هذا العميل مسجّل بفرع آخر ولا تملك صلاحية العرض.");
//         setCanEdit(false);
//         setDocs([]);
//         return;
//       }

//       const existingDocs: ExistingDoc[] = docsData.documents ?? [];
//       if (existingDocs.length > 0) {
//         setDocs(
//           existingDocs.map((d) => {
//             const fixedName = correctDocName(d.DocName);
//             const matchedType = matchDocType(fixedName);
//             const isOther = !matchedType;
//             return {
//               key: makeId(),
//               docId: d.DocId,
//               docType: isOther ? OTHER_DOC_TYPE : matchedType!,
//               customName: isOther ? fixedName : "",
//               docDate: d.DocDate ? new Date(d.DocDate).toISOString().slice(0, 10) : "",
//               file: undefined,
//               fileLabel: undefined,
//               existingPath: d.FilePath,
//             };
//           })
//         );
//         setMessage("تم تحميل مستندات العميل الحالية.");
//       } else {
//         setDocs([{ key: makeId(), docType: "", customName: "", docDate: "" }]);
//       }
//     } catch (err) {
//       setMessage(
//         err instanceof Error
//           ? err.message
//           : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDeleteRow = async (row: DocRowState) => {
//     if (!canEdit) return;
//     if (!row.docId) {
//       removeRowLocal(row.key);
//       return;
//     }
//     const confirm = window.confirm("سيتم حذف المستند نهائياً، هل تريد المتابعة؟");
//     if (!confirm) return;
//     try {
//       const res = await fetch("/api/documents/delete", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include",
//         body: JSON.stringify({ docId: row.docId }),
//       });
//       const data = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(data.message || "تعذر حذف المستند.");
//       removeRowLocal(row.key, true);
//       setMessage("تم حذف المستند بنجاح.");
//     } catch (err) {
//       setMessage(err instanceof Error ? err.message : "تعذر حذف المستند، حاول لاحقاً.");
//     }
//   };

//   const handleSave = async () => {
//     if (!clientCode.trim()) {
//       setMessage("يرجى إدخال كود العميل.");
//       return;
//     }
//     if (!clientName.trim() && !isExisting) {
//       setMessage("يرجى إدخال اسم العميل.");
//       return;
//     }
//     if (!canEdit) {
//       setMessage("ليس لديك صلاحية التعديل على هذا العميل.");
//       return;
//     }
//     const rowsToSave = docs.filter((row) => row.docType && (row.file || row.docId));
//     if (rowsToSave.length === 0) {
//       setMessage("أضف مستنداً واحداً على الأقل.");
//       return;
//     }
//     setLoading(true);
//     setMessage("");
//     try {
//       if (!isExisting) {
//         const createRes = await fetch("/api/clients", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           credentials: "include",
//           body: JSON.stringify({ clientCode, clientName }),
//         });
//         const createData = await createRes.json().catch(() => ({}));
//         if (!createRes.ok) throw new Error(createData.message || "تعذر إنشاء العميل.");
//         setIsExisting(true);
//       }
//       for (const row of rowsToSave) {
//         const baseName = row.docType === OTHER_DOC_TYPE ? row.customName || row.docType : row.docType;
//         const docName = baseName.trim();
//         if (!docName) throw new Error("يرجى إدخال اسم المستند.");
//         let fileUrl: string | undefined;
//         if (row.file) {
//           const formData = new FormData();
//           const renamedFile = renameFileWithClientCode(row.file, docName, clientCode.trim());
//           formData.append("file", renamedFile);
//           formData.append("docName", docName);
//           if (row.docDate) formData.append("docDate", row.docDate);
//           const uploadRes = await fetch(
//             `/api/archives/upload?clientCode=${encodeURIComponent(clientCode.trim())}`,
//             { method: "POST", body: formData }
//           );
//           const uploadData = await uploadRes.json().catch(() => ({}));
//           if (!uploadRes.ok)
//             throw new Error(uploadData.message || "تعذر رفع الملف أو الاتصال بالخدمة.");
//           fileUrl = extractFileUrl(uploadData);
//           if (!fileUrl) throw new Error("لم يتم إرجاع رابط الملف من خدمة الأرشفة.");
//         } else if (row.existingPath) {
//           fileUrl = row.existingPath;
//         } else {
//           throw new Error("أرفق ملفاً للمستند.");
//         }
//         const saveRes = await fetch(`/api/clients/${clientCode.trim()}`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           credentials: "include",
//           body: JSON.stringify({
//             docId: row.docId,
//             clientName,
//             docName,
//             docDate: row.docDate || null,
//             fileUrl,
//             // تحديث فقط إذا كنا نرسل docId؛ وإلا أضف مستنداً جديداً مع لاحقة رقمية تلقائية
//             replaceExisting: !!row.docId,
//           }),
//         });
//         const saveData = await saveRes.json().catch(() => ({}));
//         if (!saveRes.ok) throw new Error(saveData.message || "تعذر حفظ المستند.");
//       }
//       window.confirm(" تم حفظ المستندات بنجاح");
//       setMessage("تم حفظ المستندات بنجاح.");
//     } catch (err) {
//       setMessage(
//         err instanceof Error ? err.message : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const docTypeOptions = useMemo(
//     () =>
//       DOC_TYPES.map((t) => (
//         <option key={t} value={t}>
//           {t}
//         </option>
//       )),
//     []
//   );

//   return (
//     <main className="min-h-screen bg-[var(--background)] px-4 py-8">
//       {allowed === false ? (
//         <div className="mx-auto max-w-3xl text-center text-rose-600 font-semibold">
//           غير مصرح لك بفتح هذه الصفحة.
//         </div>
//       ) : null}
//       {allowed === false ? null : (
//       <div className="mx-auto max-w-6xl space-y-6">
//         <div className="text-right">
//           <p className="text-sm text-[var(--text-muted)]">إضافة مستندات لعميل</p>
//           <h1 className="text-2xl font-semibold text-[var(--text-strong)]">إنشاء عميل ورفع مستنداته</h1>
//         </div>

//         <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div className="space-y-2 self-start">
//               <label className="block text-sm font-medium text-slate-700 text-right">كود العميل</label>
//               <input
//                 type="text"
//                 value={clientCode}
//                 onChange={(e) => setClientCode(e.target.value)}
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter") {
//                     e.preventDefault();
//                     loadClient();
//                   }
//                 }}
//                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                 placeholder="اكتب كود العميل"
//               />
//             </div>
//             <div className="space-y-2">
//               <label className="block text-sm font-medium text-slate-700 text-right">اسم العميل</label>
//               <input
//                 type="text"
//                 value={clientName}
//                 onChange={(e) => setClientName(e.target.value)}
//                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                 placeholder="اسم العميل"
//               />
//             </div>
//           </div>

//           <div className="flex flex-wrap gap-3 justify-end">
//             <button
//               type="button"
//               onClick={loadClient}
//               className="rounded-lg load-data border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--header-btn-hover)]"
//             >
//               تحميل بيانات العميل
//             </button>
//           </div>

//           <div className="space-y-3">
//             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
//               <div className="flex items-center gap-2">
//                 <h2 className="text-lg font-semibold text-[var(--text-strong)]">المستندات المراد رفعها</h2>
//                 {!canEdit ? (
//                   <span className="text-xs text-rose-600">لا تملك صلاحية التعديل لهذا العميل.</span>
//                 ) : null}
//               </div>
//               {/* ///////////////////// */}
//             </div>

//             <div className="space-y-3">
//               {docs.map((row) => {
//                 const showOther = row.docType === OTHER_DOC_TYPE;
//                 return (
//                   <div
//                     key={row.key}
//                     className="rounded-lg border border-slate-200 bg-slate-50 p-4"
//                   >
//                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
//                       <div className="md:col-span-3 space-y-1">
//                         <label className="block text-base font-medium text-slate-700 text-right">
//                           نوع المستند
//                         </label>
//                         <select
//                           value={row.docType}
//                           onChange={(e) => updateRow(row.key, { docType: e.target.value })}
//                           disabled={!canEdit}
//                           className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                         >
//                           <option value="">-- اختر نوع المستند --</option>
//                           {docTypeOptions}
//                         </select>
//                       </div>

//                       {showOther && (
//                         <div className="md:col-span-3 space-y-1">
//                           <label className="block text-base font-medium text-slate-700 text-right">
//                             اسم مخصص
//                           </label>
//                           <input
//                             type="text"
//                             value={row.customName}
//                             onChange={(e) => updateRow(row.key, { customName: e.target.value })}
//                             disabled={!canEdit}
//                             className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                             placeholder="اكتب اسم المستند"
//                           />
//                         </div>
//                       )}

//                       <div className="md:col-span-2 space-y-1">
//                         <label className="block text-base font-medium text-slate-700 text-right">
//                           التاريخ
//                         </label>
//                         <input
//                           type="date"
//                           value={row.docDate}
//                           onChange={(e) => updateRow(row.key, { docDate: e.target.value })}
//                           disabled={!canEdit}
//                           className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                         />
//                       </div>

//                       <div className="md:col-span-3 space-y-1">
//                         <label className="block text-base font-medium text-slate-700 text-right">
//                           الملف
//                         </label>

//                         {row.existingPath && (
//                           <a
//                             href={`/documents/view/${row.docId}`}
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             className="block text-base text-sky-700 underline font-medium mb-1"
//                           >
//                             عرض الملف الحالي
//                           </a>
//                         )}

//                         <input
//                           id={`file-${row.key}`}
//                           type="file"
//                           disabled={!canEdit}
//                           onChange={(e) => {
//                             const file = e.target.files?.[0];
//                             updateRow(row.key, {
//                               file,
//                               fileLabel: file ? file.name : undefined,
//                             });
//                           }}
//                           className="hidden"
//                         />
//                         <div className="flex items-center gap-2">
//                           <button
//                             type="button"
//                             disabled={!canEdit}
//                             onClick={() => {
//                               const el = document.getElementById(`file-${row.key}`) as HTMLInputElement | null;
//                               el?.click();
//                             }}
//                             className="rounded-lg upload-files border px-4 h-9 text-sm font-semibold shadow-sm hover:shadow disabled:opacity-60"
//                           >
//                             {row.fileLabel ? "تغيير الملف" : "اختر ملف"}
//                           </button>
//                           {row.fileLabel && (
//                             <span className="text-xs text-slate-500 truncate max-w-[140px]">
//                               {row.fileLabel}
//                             </span>
//                           )}
//                         </div>
//                       </div>

//                       <div className="md:col-span-1 flex justify-end">
//                         <button
//                           type="button"
//                           onClick={() => handleDeleteRow(row)}
//                           disabled={!canEdit}
//                           className="rounded-lg bg-rose-600 px-4 h-9 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
//                         >
//                           حذف
//                         </button>
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>

//           <div className="flex flex-wrap gap-3 justify-end">

//             <button
//                 type="button"
//                 onClick={addRow}
//                 disabled={!canEdit}
//                 className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
//               >
//                 إضافة مستند جديد
//               </button>
              
//             <button
//               type="button"
//               onClick={handleSave}
//               disabled={loading || !canEdit}
//               className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
//             >
//               {loading ? "جاري الحفظ..." : "حفظ المستندات"}
//             </button>
//           </div>

//           {message ? <p className="text-lg text-right text-[var(--text-strong)]">{message}</p> : null}
//         </div>
//       </div>
//       )}
//     </main>
//   );
// }


// // "use client";

// // import {
// //   DOC_TYPES,
// //   OTHER_DOC_TYPE,
// //   correctDocName,
// //   extractFileUrl,
// //   normalizeDocName,
// //   renameFileWithClientCode,
// // } from "@/lib/documents";
// // import { useEffect, useMemo, useState } from "react";

// // type DocRowState = {
// //   key: string;
// //   docId?: string;
// //   docType: string;
// //   customName: string;
// //   docDate: string;
// //   file?: File;
// //   fileLabel?: string;
// //   existingPath?: string;
// // };

// // type ExistingDoc = {
// //   DocId: string;
// //   DocName: string;
// //   DocDate?: string | null;
// //   FilePath?: string;
// // };

// // const makeId = () =>
// //   typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
// //     ? crypto.randomUUID()
// //     : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// // const matchDocType = (name: string) => {
// //   const normalized = normalizeDocName(name);
// //   return DOC_TYPES.find((t) => normalizeDocName(t) === normalized);
// // };

// // export default function NewClientPage() {
// //   const [clientCode, setClientCode] = useState("");
// //   const [clientName, setClientName] = useState("");
// //   const [isExisting, setIsExisting] = useState(false);
// //   const [canEdit, setCanEdit] = useState(true);
// //   const [message, setMessage] = useState("");
// //   const [loading, setLoading] = useState(false);
// //   const [docs, setDocs] = useState<DocRowState[]>([]);

// //   useEffect(() => {
// //     setDocs([{ key: makeId(), docType: "", customName: "", docDate: "" }]);
// //   }, []);

// //   const addRow = () => {
// //     setDocs((prev) => [...prev, { key: makeId(), docType: "", customName: "", docDate: "" }]);
// //   };

// //   const removeRowLocal = (key: string, allowEmpty = false) => {
// //     setDocs((prev) => {
// //       const next = prev.filter((d) => d.key !== key);
// //       if (next.length === 0 && !allowEmpty) {
// //         return [{ key: makeId(), docType: "", customName: "", docDate: "" }];
// //       }
// //       return next;
// //     });
// //   };

// //   const updateRow = (key: string, patch: Partial<DocRowState>) => {
// //     setDocs((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
// //   };

// //   const loadClient = async () => {
// //     if (!clientCode.trim()) return;
// //     setLoading(true);
// //     setMessage("");
// //     setCanEdit(true);
// //     try {
// //       const res = await fetch(`/api/clients?code=${encodeURIComponent(clientCode.trim())}`, {
// //         credentials: "include",
// //       });
// //       if (!res.ok) throw new Error("تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.");
// //       const data = await res.json().catch(() => ({}));

// //       if (data?.client) {
// //         const unauthorized = data.unauthorized;
// //         setIsExisting(!unauthorized);
// //         setClientName(data.client.clientName || "");
// //         if (unauthorized) {
// //           setMessage(data.denyReason || "هذا العميل مسجّل بفرع آخر ولا تملك صلاحية التعديل.");
// //           setCanEdit(false);
// //           setDocs([]);
// //           return;
// //         }
// //       } else {
// //         setIsExisting(false);
// //         setClientName("");
// //         setMessage("العميل غير موجود، سيتم إنشاؤه عند الحفظ.");
// //       }

// //       const docsRes = await fetch(`/api/clients/${clientCode.trim()}`, {
// //         credentials: "include",
// //       });
// //       if (!docsRes.ok) throw new Error("تعذر جلب مستندات العميل، حاول مرة أخرى.");
// //       const docsData = await docsRes.json().catch(() => ({}));

// //       if (docsData.unauthorized) {
// //         setMessage(docsData.denyReason || "هذا العميل مسجّل بفرع آخر ولا تملك صلاحية العرض.");
// //         setCanEdit(false);
// //         setDocs([]);
// //         return;
// //       }

// //       const existingDocs: ExistingDoc[] = docsData.documents ?? [];
// //       if (existingDocs.length > 0) {
// //         setDocs(
// //           existingDocs.map((d) => {
// //             const fixedName = correctDocName(d.DocName);
// //             const matchedType = matchDocType(fixedName);
// //             const isOther = !matchedType;
// //             return {
// //               key: makeId(),
// //               docId: d.DocId,
// //               docType: isOther ? OTHER_DOC_TYPE : matchedType!,
// //               customName: isOther ? fixedName : "",
// //               docDate: d.DocDate ? new Date(d.DocDate).toISOString().slice(0, 10) : "",
// //               file: undefined,
// //               fileLabel: undefined,
// //               existingPath: d.FilePath,
// //             };
// //           })
// //         );
// //         setMessage("تم تحميل مستندات العميل الحالية.");
// //       } else {
// //         setDocs([{ key: makeId(), docType: "", customName: "", docDate: "" }]);
// //       }
// //     } catch (err) {
// //       setMessage(
// //         err instanceof Error
// //           ? err.message
// //           : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
// //       );
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const handleDeleteRow = async (row: DocRowState) => {
// //     if (!canEdit) return;
// //     if (!row.docId) {
// //       removeRowLocal(row.key);
// //       return;
// //     }
// //     const confirm = window.confirm("سيتم حذف المستند نهائياً، هل تريد المتابعة؟");
// //     if (!confirm) return;
// //     try {
// //       const res = await fetch("/api/documents/delete", {
// //         method: "POST",
// //         headers: { "Content-Type": "application/json" },
// //         credentials: "include",
// //         body: JSON.stringify({ docId: row.docId }),
// //       });
// //       const data = await res.json().catch(() => ({}));
// //       if (!res.ok) throw new Error(data.message || "تعذر حذف المستند.");
// //       removeRowLocal(row.key, true);
// //       setMessage("تم حذف المستند بنجاح.");
// //     } catch (err) {
// //       setMessage(err instanceof Error ? err.message : "تعذر حذف المستند، حاول لاحقاً.");
// //     }
// //   };

// //   const handleSave = async () => {
// //     if (!clientCode.trim()) {
// //       setMessage("يرجى إدخال كود العميل.");
// //       return;
// //     }
// //     if (!clientName.trim() && !isExisting) {
// //       setMessage("يرجى إدخال اسم العميل.");
// //       return;
// //     }
// //     if (!canEdit) {
// //       setMessage("ليس لديك صلاحية التعديل على هذا العميل.");
// //       return;
// //     }
// //     const rowsToSave = docs.filter((row) => row.docType && (row.file || row.docId));
// //     if (rowsToSave.length === 0) {
// //       setMessage("أضف مستنداً واحداً على الأقل.");
// //       return;
// //     }
// //     setLoading(true);
// //     setMessage("");
// //     try {
// //       if (!isExisting) {
// //         const createRes = await fetch("/api/clients", {
// //           method: "POST",
// //           headers: { "Content-Type": "application/json" },
// //           credentials: "include",
// //           body: JSON.stringify({ clientCode, clientName }),
// //         });
// //         const createData = await createRes.json().catch(() => ({}));
// //         if (!createRes.ok) throw new Error(createData.message || "تعذر إنشاء العميل.");
// //         setIsExisting(true);
// //       }
// //       for (const row of rowsToSave) {
// //         const baseName = row.docType === OTHER_DOC_TYPE ? row.customName || row.docType : row.docType;
// //         const docName = baseName.trim();
// //         if (!docName) throw new Error("يرجى إدخال اسم المستند.");
// //         let fileUrl: string | undefined;
// //         if (row.file) {
// //           const formData = new FormData();
// //           const renamedFile = renameFileWithClientCode(row.file, docName, clientCode.trim());
// //           formData.append("file", renamedFile);
// //           formData.append("docName", docName);
// //           if (row.docDate) formData.append("docDate", row.docDate);
// //           const uploadRes = await fetch(
// //             `/api/archives/upload?clientCode=${encodeURIComponent(clientCode.trim())}`,
// //             { method: "POST", body: formData }
// //           );
// //           const uploadData = await uploadRes.json().catch(() => ({}));
// //           if (!uploadRes.ok)
// //             throw new Error(uploadData.message || "تعذر رفع الملف أو الاتصال بالخدمة.");
// //           fileUrl = extractFileUrl(uploadData);
// //           if (!fileUrl) throw new Error("لم يتم إرجاع رابط الملف من خدمة الأرشفة.");
// //         } else if (row.existingPath) {
// //           fileUrl = row.existingPath;
// //         } else {
// //           throw new Error("أرفق ملفاً للمستند.");
// //         }
// //         const saveRes = await fetch(`/api/clients/${clientCode.trim()}`, {
// //           method: "POST",
// //           headers: { "Content-Type": "application/json" },
// //           credentials: "include",
// //           body: JSON.stringify({
// //             docId: row.docId,
// //             clientName,
// //             docName,
// //             docDate: row.docDate || null,
// //             fileUrl,
// //             // تحديث فقط إذا كنا نرسل docId؛ وإلا أضف مستنداً جديداً مع لاحقة رقمية تلقائية
// //             replaceExisting: !!row.docId,
// //           }),
// //         });
// //         const saveData = await saveRes.json().catch(() => ({}));
// //         if (!saveRes.ok) throw new Error(saveData.message || "تعذر حفظ المستند.");
// //       }
// //       window.confirm(" تم حفظ المستندات بنجاح");
// //       setMessage("تم حفظ المستندات بنجاح.");
// //     } catch (err) {
// //       setMessage(
// //         err instanceof Error ? err.message : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
// //       );
// //     } finally {
// //       setLoading(false);
// //     }
// //   };

// //   const docTypeOptions = useMemo(
// //     () =>
// //       DOC_TYPES.map((t) => (
// //         <option key={t} value={t}>
// //           {t}
// //         </option>
// //       )),
// //     []
// //   );

// //   return (
// //     <main className="min-h-screen bg-[var(--background)] px-4 py-8">
// //       <div className="mx-auto max-w-6xl space-y-6">
// //         <div className="text-right">
// //           <p className="text-sm text-[var(--text-muted)]">إضافة مستندات لعميل</p>
// //           <h1 className="text-2xl font-semibold text-[var(--text-strong)]">إنشاء عميل ورفع مستنداته</h1>
// //         </div>

// //         <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
// //           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
// //             <div className="space-y-2 self-start">
// //               <label className="block text-sm font-medium text-slate-700 text-right">كود العميل</label>
// //               <input
// //                 type="text"
// //                 value={clientCode}
// //                 onChange={(e) => setClientCode(e.target.value)}
// //                 onKeyDown={(e) => {
// //                   if (e.key === "Enter") {
// //                     e.preventDefault();
// //                     loadClient();
// //                   }
// //                 }}
// //                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
// //                 placeholder="اكتب كود العميل"
// //               />
// //             </div>
// //             <div className="space-y-2">
// //               <label className="block text-sm font-medium text-slate-700 text-right">اسم العميل</label>
// //               <input
// //                 type="text"
// //                 value={clientName}
// //                 onChange={(e) => setClientName(e.target.value)}
// //                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
// //                 placeholder="اسم العميل"
// //               />
// //             </div>
// //           </div>

// //           <div className="flex flex-wrap gap-3 justify-end">
// //             <button
// //               type="button"
// //               onClick={loadClient}
// //               className="rounded-lg load-data border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--header-btn-hover)]"
// //             >
// //               تحميل بيانات العميل
// //             </button>
// //           </div>

// //           <div className="space-y-3">
// //             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
// //               <div className="flex items-center gap-2">
// //                 <h2 className="text-lg font-semibold text-[var(--text-strong)]">المستندات المراد رفعها</h2>
// //                 {!canEdit ? (
// //                   <span className="text-xs text-rose-600">لا تملك صلاحية التعديل لهذا العميل.</span>
// //                 ) : null}
// //               </div>
// //               <button
// //                 type="button"
// //                 onClick={addRow}
// //                 disabled={!canEdit}
// //                 className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
// //               >
// //                 إضافة مستند جديد
// //               </button>
// //             </div>

// //             <div className="space-y-3">
// //               {docs.map((row) => {
// //                 const showOther = row.docType === OTHER_DOC_TYPE;
// //                 return (
// //                   <div
// //                     key={row.key}
// //                     className="rounded-lg border border-slate-200 bg-slate-50 p-4"
// //                   >
// //                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
// //                       <div className="md:col-span-3 space-y-1">
// //                         <label className="block text-base font-medium text-slate-700 text-right">
// //                           نوع المستند
// //                         </label>
// //                         <select
// //                           value={row.docType}
// //                           onChange={(e) => updateRow(row.key, { docType: e.target.value })}
// //                           disabled={!canEdit}
// //                           className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
// //                         >
// //                           <option value="">-- اختر نوع المستند --</option>
// //                           {docTypeOptions}
// //                         </select>
// //                       </div>

// //                       {showOther && (
// //                         <div className="md:col-span-3 space-y-1">
// //                           <label className="block text-base font-medium text-slate-700 text-right">
// //                             اسم مخصص
// //                           </label>
// //                           <input
// //                             type="text"
// //                             value={row.customName}
// //                             onChange={(e) => updateRow(row.key, { customName: e.target.value })}
// //                             disabled={!canEdit}
// //                             className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
// //                             placeholder="اكتب اسم المستند"
// //                           />
// //                         </div>
// //                       )}

// //                       <div className="md:col-span-2 space-y-1">
// //                         <label className="block text-base font-medium text-slate-700 text-right">
// //                           التاريخ
// //                         </label>
// //                         <input
// //                           type="date"
// //                           value={row.docDate}
// //                           onChange={(e) => updateRow(row.key, { docDate: e.target.value })}
// //                           disabled={!canEdit}
// //                           className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
// //                         />
// //                       </div>

// //                       <div className="md:col-span-3 space-y-1">
// //                         <label className="block text-base font-medium text-slate-700 text-right">
// //                           الملف
// //                         </label>

// //                         {row.existingPath && (
// //                           <a
// //                             href={`/documents/view/${row.docId}`}
// //                             target="_blank"
// //                             rel="noopener noreferrer"
// //                             className="block text-base text-sky-700 underline font-medium mb-1"
// //                           >
// //                             عرض الملف الحالي
// //                           </a>
// //                         )}

// //                         <input
// //                           id={`file-${row.key}`}
// //                           type="file"
// //                           disabled={!canEdit}
// //                           onChange={(e) => {
// //                             const file = e.target.files?.[0];
// //                             updateRow(row.key, {
// //                               file,
// //                               fileLabel: file ? file.name : undefined,
// //                             });
// //                           }}
// //                           className="hidden"
// //                         />
// //                         <div className="flex items-center gap-2">
// //                           <button
// //                             type="button"
// //                             disabled={!canEdit}
// //                             onClick={() => {
// //                               const el = document.getElementById(`file-${row.key}`) as HTMLInputElement | null;
// //                               el?.click();
// //                             }}
// //                             className="rounded-lg upload-files border px-4 h-9 text-sm font-semibold shadow-sm hover:shadow disabled:opacity-60"
// //                           >
// //                             {row.fileLabel ? "تغيير الملف" : "اختر ملف"}
// //                           </button>
// //                           {row.fileLabel && (
// //                             <span className="text-xs text-slate-500 truncate max-w-[140px]">
// //                               {row.fileLabel}
// //                             </span>
// //                           )}
// //                         </div>
// //                       </div>

// //                       <div className="md:col-span-1 flex justify-end">
// //                         <button
// //                           type="button"
// //                           onClick={() => handleDeleteRow(row)}
// //                           disabled={!canEdit}
// //                           className="rounded-lg bg-rose-600 px-4 h-9 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
// //                         >
// //                           حذف
// //                         </button>
// //                       </div>
// //                     </div>
// //                   </div>
// //                 );
// //               })}
// //             </div>
// //           </div>

// //           <div className="flex flex-wrap gap-3 justify-end">
// //             <button
// //               type="button"
// //               onClick={handleSave}
// //               disabled={loading || !canEdit}
// //               className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
// //             >
// //               {loading ? "جاري الحفظ..." : "حفظ المستندات"}
// //             </button>
// //           </div>

// //           {message ? <p className="text-lg text-right text-[var(--text-strong)]">{message}</p> : null}
// //         </div>
// //       </div>
// //     </main>
// //   );
// // }






// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { useRouter } from "next/navigation";
// import {
//   DOC_TYPES,
//   OTHER_DOC_TYPE,
//   correctDocName,
//   extractFileUrl,
//   normalizeDocName,
//   renameFileWithClientCode,
// } from "@/lib/documents";
// import { canAccessUploadPage } from "@/lib/access";
// import { normalizeBranch as normalizeBranchPerm } from "@/lib/permissions";

// type DocRowState = {
//   key: string;
//   docId?: string;
//   docType: string;
//   customName: string;
//   docDate: string;
//   file?: File;
//   fileLabel?: string;
//   existingPath?: string;
// };

// type ExistingDoc = {
//   DocId: string;
//   DocName: string;
//   DocDate?: string | null;
//   FilePath?: string;
// };

// type BranchOption = { code: string; name: string };

// const makeId = () =>
//   typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
//     ? crypto.randomUUID()
//     : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// const matchDocType = (name: string) => {
//   const normalized = normalizeDocName(name);
//   return DOC_TYPES.find((t) => normalizeDocName(t) === normalized);
// };

// export default function NewClientPage() {
//   const router = useRouter();
//   const [allowed, setAllowed] = useState<boolean | null>(null);
//   const [isAdmin, setIsAdmin] = useState(false);
//   const [userBranch, setUserBranch] = useState("");
//   const [branches, setBranches] = useState<BranchOption[]>([]);
//   const [selectedBranch, setSelectedBranch] = useState("");
//   const [clientCode, setClientCode] = useState("");
//   const [clientName, setClientName] = useState("");
//   const [isExisting, setIsExisting] = useState(false);
//   const [canEdit, setCanEdit] = useState(true);
//   const [message, setMessage] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [docs, setDocs] = useState<DocRowState[]>([]);

//   useEffect(() => {
//     setDocs([{ key: makeId(), docType: "", customName: "", docDate: "" }]);
//   }, []);

//   // صلاحيات الصفحة + تحميل الفروع للإدمن
//   useEffect(() => {
//     const checkAccess = async () => {
//       try {
//         const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
//         if (!res.ok) {
//           setAllowed(false);
//           return;
//         }
//         const data = await res.json().catch(() => ({}));
//         const userData = data?.user ?? data;
//         const isAllowed = canAccessUploadPage(userData);
//         const branchNorm = normalizeBranchPerm(userData?.branch);
//         const empId = String(userData?.empId ?? "").trim();
//         const adminFlag = branchNorm === "100" || ["403", "3425"].includes(empId);
//         setUserBranch(branchNorm);
//         setIsAdmin(adminFlag);
//         setSelectedBranch(branchNorm);

//         if (adminFlag) {
//           try {
//             const bRes = await fetch("/api/branches", { credentials: "include", cache: "no-store" });
//             const bData = await bRes.json().catch(() => ({}));
//             if (bRes.ok && Array.isArray(bData.branches)) {
//               setBranches(bData.branches);
//             }
//           } catch {
//             /* ignore */
//           }
//         }

//         setAllowed(isAllowed);
//         if (!isAllowed) {
//           setMessage("لا تملك صلاحية الوصول إلى صفحة إضافة العميل.");
//         }
//       } catch {
//         setAllowed(false);
//       }
//     };
//     checkAccess();
//   }, [router]);

//   const addRow = () => {
//     setDocs((prev) => [...prev, { key: makeId(), docType: "", customName: "", docDate: "" }]);
//   };

//   const removeRowLocal = (key: string, allowEmpty = false) => {
//     setDocs((prev) => {
//       const next = prev.filter((d) => d.key !== key);
//       if (next.length === 0 && !allowEmpty) {
//         return [{ key: makeId(), docType: "", customName: "", docDate: "" }];
//       }
//       return next;
//     });
//   };

//   const updateRow = (key: string, patch: Partial<DocRowState>) => {
//     setDocs((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
//   };

//   const loadClient = async () => {
//     if (!clientCode.trim()) return;
//     setLoading(true);
//     setMessage("");
//     setCanEdit(true);
//     try {
//       const res = await fetch(`/api/clients?code=${encodeURIComponent(clientCode.trim())}`, {
//         credentials: "include",
//       });
//       if (!res.ok) throw new Error("تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.");
//       const data = await res.json().catch(() => ({}));

//       if (data?.client) {
//         const unauthorized = data.unauthorized;
//         setIsExisting(!unauthorized);
//         setClientName(data.client.clientName || "");
//         if (unauthorized) {
//           setMessage(data.denyReason || "هذا العميل في فرع آخر ولا تملك صلاحية التعديل.");
//           setCanEdit(false);
//           setDocs([]);
//           return;
//         }
//       } else {
//         setIsExisting(false);
//         setClientName("");
//         setMessage("العميل غير موجود، سيتم إنشاؤه عند الحفظ.");
//       }

//       const docsRes = await fetch(`/api/clients/${clientCode.trim()}`, {
//         credentials: "include",
//       });
//       if (!docsRes.ok) throw new Error("تعذر جلب مستندات العميل، حاول مرة أخرى.");
//       const docsData = await docsRes.json().catch(() => ({}));

//       if (docsData.unauthorized) {
//         setMessage(docsData.denyReason || "هذا العميل في فرع آخر ولا تملك صلاحية العرض.");
//         setCanEdit(false);
//         setDocs([]);
//         return;
//       }

//       const existingDocs: ExistingDoc[] = docsData.documents ?? [];
//       if (existingDocs.length > 0) {
//         setDocs(
//           existingDocs.map((d) => {
//             const fixedName = correctDocName(d.DocName);
//             const matchedType = matchDocType(fixedName);
//             const isOther = !matchedType;
//             return {
//               key: makeId(),
//               docId: d.DocId,
//               docType: isOther ? OTHER_DOC_TYPE : matchedType!,
//               customName: isOther ? fixedName : "",
//               docDate: d.DocDate ? new Date(d.DocDate).toISOString().slice(0, 10) : "",
//               file: undefined,
//               fileLabel: undefined,
//               existingPath: d.FilePath,
//             };
//           })
//         );
//         setMessage("تم تحميل مستندات العميل.");
//       } else {
//         setDocs([{ key: makeId(), docType: "", customName: "", docDate: "" }]);
//       }
//     } catch (err) {
//       setMessage(
//         err instanceof Error
//           ? err.message
//           : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDeleteRow = async (row: DocRowState) => {
//     if (!canEdit) return;
//     if (!row.docId) {
//       removeRowLocal(row.key);
//       return;
//     }
//     const confirmDelete = window.confirm("سيتم حذف المستند نهائياً، هل تريد المتابعة؟");
//     if (!confirmDelete) return;
//     try {
//       const res = await fetch("/api/documents/delete", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         credentials: "include",
//         body: JSON.stringify({ docId: row.docId }),
//       });
//       const data = await res.json().catch(() => ({}));
//       if (!res.ok) throw new Error(data.message || "تعذر حذف المستند.");
//       removeRowLocal(row.key, true);
//       setMessage("تم حذف المستند بنجاح.");
//     } catch (err) {
//       setMessage(err instanceof Error ? err.message : "تعذر حذف المستند، حاول لاحقاً.");
//     }
//   };

//   const handleSave = async () => {
//     if (!clientCode.trim()) {
//       setMessage("يرجى إدخال كود العميل.");
//       return;
//     }
//     if (!clientName.trim() && !isExisting) {
//       setMessage("يرجى إدخال اسم العميل.");
//       return;
//     }
//     if (!canEdit) {
//       setMessage("ليس لديك صلاحية التعديل على هذا العميل.");
//       return;
//     }
//     const rowsToSave = docs.filter((row) => row.docType && (row.file || row.docId));
//     if (rowsToSave.length === 0) {
//       setMessage("أضف مستنداً واحداً على الأقل.");
//       return;
//     }
//     setLoading(true);
//     setMessage("");
//     try {
//       if (!isExisting) {
//         const createRes = await fetch("/api/clients", {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           credentials: "include",
//           body: JSON.stringify({
//             clientCode,
//             clientName,
//             branch: isAdmin ? selectedBranch || userBranch : undefined,
//           }),
//         });
//         const createData = await createRes.json().catch(() => ({}));
//         if (!createRes.ok) throw new Error(createData.message || "تعذر إنشاء العميل.");
//         setIsExisting(true);
//       }
//       for (const row of rowsToSave) {
//         const baseName = row.docType === OTHER_DOC_TYPE ? row.customName || row.docType : row.docType;
//         const docName = baseName.trim();
//         if (!docName) throw new Error("يرجى إدخال اسم المستند.");
//         let fileUrl: string | undefined;
//         if (row.file) {
//           const formData = new FormData();
//           const renamedFile = renameFileWithClientCode(row.file, docName, clientCode.trim());
//           formData.append("file", renamedFile);
//           formData.append("docName", docName);
//           if (row.docDate) formData.append("docDate", row.docDate);
//           const uploadRes = await fetch(
//             `/api/archives/upload?clientCode=${encodeURIComponent(clientCode.trim())}`,
//             { method: "POST", body: formData }
//           );
//           const uploadData = await uploadRes.json().catch(() => ({}));
//           if (!uploadRes.ok)
//             throw new Error(uploadData.message || "تعذر رفع الملف أو الاتصال بالخدمة.");
//           fileUrl = extractFileUrl(uploadData);
//           if (!fileUrl) throw new Error("لم يتم إرجاع رابط الملف من خدمة الأرشفة.");
//         } else if (row.existingPath) {
//           fileUrl = row.existingPath;
//         } else {
//           throw new Error("أرفق ملفاً للمستند.");
//         }
//         const saveRes = await fetch(`/api/clients/${clientCode.trim()}`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json" },
//           credentials: "include",
//           body: JSON.stringify({
//             docId: row.docId,
//             clientName,
//             docName,
//             docDate: row.docDate || null,
//             fileUrl,
//             replaceExisting: true,
//           }),
//         });
//         const saveData = await saveRes.json().catch(() => ({}));
//         if (!saveRes.ok) throw new Error(saveData.message || "تعذر حفظ المستند.");
//       }
//       setMessage("تم حفظ المستندات بنجاح.");
//       await loadClient();
//     } catch (err) {
//       setMessage(
//         err instanceof Error ? err.message : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
//       );
//     } finally {
//       setLoading(false);
//     }
//   };

//   const docTypeOptions = useMemo(
//     () =>
//       DOC_TYPES.map((t) => (
//         <option key={t} value={t}>
//           {t}
//         </option>
//       )),
//     []
//   );

//   if (allowed === false) {
//     return (
//       <main className="min-h-screen flex items-center justify-center">
//         <p className="text-lg font-semibold text-rose-600">ليس لديك صلاحية الوصول.</p>
//       </main>
//     );
//   }

//   return (
//     <main className="min-h-screen bg-[var(--background)] px-4 py-8">
//       <div className="mx-auto max-w-6xl space-y-6">
//         <div className="text-right">
//           <p className="text-sm text-[var(--text-muted)]">إضافة مستندات لعميل</p>
//           <h1 className="text-2xl font-semibold text-[var(--text-strong)]">إنشاء عميل ورفع مستنداته</h1>
//         </div>

//         <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <div className="space-y-2 self-start">
//               <label className="block text-sm font-medium text-slate-700 text-right">كود العميل</label>
//               <input
//                 type="text"
//                 value={clientCode}
//                 onChange={(e) => setClientCode(e.target.value)}
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter") {
//                     e.preventDefault();
//                     loadClient();
//                   }
//                 }}
//                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                 placeholder="اكتب كود العميل"
//               />
//             </div>
//             <div className="space-y-2">
//               <label className="block text-sm font-medium text-slate-700 text-right">اسم العميل</label>
//               <input
//                 type="text"
//                 value={clientName}
//                 onChange={(e) => setClientName(e.target.value)}
//                 className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                 placeholder="اسم العميل"
//               />
//             </div>
//             {isAdmin ? (
//               <div className="space-y-2">
//                 <label className="block text-sm font-medium text-slate-700 text-right">اختر الفرع</label>
//                 <select
//                   value={selectedBranch}
//                   onChange={(e) => setSelectedBranch(e.target.value)}
//                   className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
//                 >
//                   <option value="">-- اختر الفرع --</option>
//                   {branches.map((b) => (
//                     <option key={b.code} value={b.code}>
//                       {b.name}
//                     </option>
//                   ))}
//                 </select>
//               </div>
//             ) : null}
//           </div>

//           <div className="flex flex-wrap gap-3 justify-end">
//             <button
//               type="button"
//               onClick={loadClient}
//               className="rounded-lg load-data border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--header-btn-hover)]"
//             >
//               تحميل بيانات العميل
//             </button>
//           </div>

//           <div className="space-y-3">
//             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
//               <div className="flex items-center gap-2">
//                 <h2 className="text-lg font-semibold text-[var(--text-strong)]">المستندات المراد رفعها</h2>
//                 {!canEdit ? (
//                   <span className="text-xs text-rose-600">لا تملك صلاحية التعديل لهذا العميل.</span>
//                 ) : null}
//               </div>
          
//             </div>

//             <div className="space-y-3">
//               {docs.map((row) => {
//                 const showOther = row.docType === OTHER_DOC_TYPE;
//                 return (
//                   <div
//                     key={row.key}
//                     className="rounded-lg border border-slate-200 bg-slate-50 p-4"
//                   >
//                     <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
//                       <div className="md:col-span-3 space-y-1">
//                         <label className="block text-base font-medium text-slate-700 text-right">
//                           نوع المستند
//                         </label>
//                         <select
//                           value={row.docType}
//                           onChange={(e) => updateRow(row.key, { docType: e.target.value })}
//                           disabled={!canEdit}
//                           className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                         >
//                           <option value="">-- اختر نوع المستند --</option>
//                           {docTypeOptions}
//                         </select>
//                       </div>

//                       {showOther && (
//                         <div className="md:col-span-3 space-y-1">
//                           <label className="block text-base font-medium text-slate-700 text-right">
//                             اسم مخصص
//                           </label>
//                           <input
//                             type="text"
//                             value={row.customName}
//                             onChange={(e) => updateRow(row.key, { customName: e.target.value })}
//                             disabled={!canEdit}
//                             className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                             placeholder="اكتب اسم المستند"
//                           />
//                         </div>
//                       )}

//                       <div className="md:col-span-2 space-y-1">
//                         <label className="block text-base font-medium text-slate-700 text-right">
//                           التاريخ
//                         </label>
//                         <input
//                           type="date"
//                           value={row.docDate}
//                           onChange={(e) => updateRow(row.key, { docDate: e.target.value })}
//                           disabled={!canEdit}
//                           className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
//                         />
//                       </div>

//                       <div className="md:col-span-3 space-y-1">
//                         <label className="block text-base font-medium text-slate-700 text-right">
//                           الملف
//                         </label>

//                         {row.existingPath && (
//                           <a
//                             href={`/documents/view/${row.docId}`}
//                             target="_blank"
//                             rel="noopener noreferrer"
//                             className="block text-base text-sky-700 underline font-medium mb-1"
//                           >
//                             عرض الملف الحالي
//                           </a>
//                         )}

//                         <input
//                           id={`file-${row.key}`}
//                           type="file"
//                           disabled={!canEdit}
//                           onChange={(e) => {
//                             const file = e.target.files?.[0];
//                             updateRow(row.key, {
//                               file,
//                               fileLabel: file ? file.name : undefined,
//                             });
//                           }}
//                           className="hidden"
//                         />
//                         <div className="flex items-center gap-2">
//                           <button
//                             type="button"
//                             disabled={!canEdit}
//                             onClick={() => {
//                               const el = document.getElementById(`file-${row.key}`) as HTMLInputElement | null;
//                               el?.click();
//                             }}
//                             className="rounded-lg upload-files border px-4 h-9 text-sm font-semibold shadow-sm hover:shadow disabled:opacity-60"
//                           >
//                             {row.fileLabel ? "تغيير الملف" : "اختر ملف"}
//                           </button>
//                           {row.fileLabel && (
//                             <span className="text-xs text-slate-500 truncate max-w-[140px]">
//                               {row.fileLabel}
//                             </span>
//                           )}
//                         </div>
//                       </div>

//                       <div className="md:col-span-1 flex justify-end">
//                         <button
//                           type="button"
//                           onClick={() => handleDeleteRow(row)}
//                           disabled={!canEdit}
//                           className="rounded-lg bg-rose-600 px-4 h-9 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
//                         >
//                           حذف
//                         </button>
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </div>

//           <div className="flex flex-wrap gap-3 justify-end">
//             <button
//                 type="button"
//                 onClick={addRow}
//                 disabled={!canEdit}
//                 className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
//               >
//                 إضافة مستند جديد
//               </button>
//             <button
//               type="button"
//               onClick={handleSave}
//               disabled={loading || !canEdit}
//               className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
//             >
//               {loading ? "جاري الحفظ..." : "حفظ المستندات"}
//             </button>
//           </div>

//           {message ? <p className="text-sm text-right text-[var(--text-strong)]">{message}</p> : null}
//         </div>
//       </div>
//     </main>
//   );
// }







"use client";

import {
  DOC_TYPES,
  OTHER_DOC_TYPE,
  correctDocName,
  extractFileUrl,
  normalizeDocName,
  renameFileWithClientCode,
} from "@/lib/documents";
import { normalizeBranch as normalizeBranchPerm } from "@/lib/permissions";
import { canAccessAllBranches, canCreateClient } from "@/lib/permissions-special";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type DocRowState = {
  key: string;
  docId?: string;
  docType: string;
  customName: string;
  docDate: string;
  file?: File;
  fileLabel?: string;
  existingPath?: string;
};

type ExistingDoc = {
  DocId: string;
  DocName: string;
  DocDate?: string | null;
  FilePath?: string;
};

type BranchOption = { code: string; name: string };

const makeId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const matchDocType = (name: string) => {
  const normalized = normalizeDocName(name);
  return DOC_TYPES.find((t) => normalizeDocName(t) === normalized);
};

export default function NewClientPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userBranch, setUserBranch] = useState("");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientLoaded, setClientLoaded] = useState(false);
  const [clientNameHint, setClientNameHint] = useState("");
  const [isExisting, setIsExisting] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocRowState[]>([]);

  const today = () => new Date().toISOString().slice(0, 10);

  useEffect(() => {
    setDocs([{ key: makeId(), docType: "", customName: "", docDate: today() }]);
  }, []);

  useEffect(() => {
    setClientLoaded(false);
    setClientName("");
    setClientNameHint("");
    setIsExisting(false);
  }, [clientCode]);

  // صلاحيات الصفحة + تحميل الفروع للإدمن
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const data = await res.json().catch(() => ({}));
        const userData = data?.user ?? data;
        const isAllowed = canCreateClient(userData);
        const branchNorm = normalizeBranchPerm(userData?.branch);
        const adminFlag = canAccessAllBranches(userData);
        setUserBranch(branchNorm);
        setIsAdmin(adminFlag);
        setSelectedBranch(branchNorm);

        if (adminFlag) {
          try {
            const bRes = await fetch("/api/branches", { credentials: "include", cache: "no-store" });
            const bData = await bRes.json().catch(() => ({}));
            if (bRes.ok && Array.isArray(bData.branches)) {
              setBranches(bData.branches);
            }
          } catch {
            /* ignore */
          }
        }

        setAllowed(isAllowed);
        if (!isAllowed) {
          setMessage("لا تملك صلاحية الوصول إلى صفحة إضافة العميل.");
        }
      } catch {
        setAllowed(false);
      }
    };
    checkAccess();
  }, [router]);

  const addRow = () => {
    setDocs((prev) => [...prev, { key: makeId(), docType: "", customName: "", docDate: today() }]);
  };

  const removeRowLocal = (key: string, allowEmpty = false) => {
    setDocs((prev) => {
      const next = prev.filter((d) => d.key !== key);
      if (next.length === 0 && !allowEmpty) {
        return [{ key: makeId(), docType: "", customName: "", docDate: today() }];
      }
      return next;
    });
  };

  const updateRow = (key: string, patch: Partial<DocRowState>) => {
    setDocs((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleClientNameHint = () => {
    if (!clientLoaded) {
      setClientNameHint("برجاء تحميل بيانات العميل اولا");
    }
  };

  const loadClient = async () => {
    if (!clientCode.trim()) return;
    setLoading(true);
    setMessage("");
    setClientNameHint("");
    setCanEdit(true);
    setClientLoaded(false);
    try {
      const res = await fetch(`/api/clients?code=${encodeURIComponent(clientCode.trim())}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("تعذر الاتصال بقاعدة البيانات، حاول مرة أخرى.");
      const data = await res.json().catch(() => ({}));
      setClientLoaded(true);

      if (data?.client) {
        const unauthorized = data.unauthorized;
        setIsExisting(!unauthorized);
        setClientName(data.client.clientName || "");
        if (unauthorized) {
          setMessage(data.denyReason || "هذا العميل في فرع آخر ولا تملك صلاحية التعديل.");
          setCanEdit(false);
          setDocs([]);
          return;
        }
      } else {
        setIsExisting(false);
        setClientName("");
        setMessage("العميل غير موجود، سيتم إنشاؤه عند الحفظ.");
      }

      const docsRes = await fetch(`/api/clients/${clientCode.trim()}`, {
        credentials: "include",
      });
      if (!docsRes.ok) throw new Error("تعذر جلب مستندات العميل، حاول مرة أخرى.");
      const docsData = await docsRes.json().catch(() => ({}));

      if (docsData.unauthorized) {
        setMessage(docsData.denyReason || "هذا العميل في فرع آخر ولا تملك صلاحية العرض.");
        setCanEdit(false);
        setDocs([]);
        return;
      }

      const existingDocs: ExistingDoc[] = docsData.documents ?? [];
      if (existingDocs.length > 0) {
        setDocs(
          existingDocs.map((d) => {
            const fixedName = correctDocName(d.DocName);
            const matchedType = matchDocType(fixedName);
            const isOther = !matchedType;
            return {
              key: makeId(),
              docId: d.DocId,
              docType: isOther ? OTHER_DOC_TYPE : matchedType!,
              customName: isOther ? fixedName : "",
              docDate: d.DocDate ? new Date(d.DocDate).toISOString().slice(0, 10) : "",
              file: undefined,
              fileLabel: undefined,
              existingPath: d.FilePath,
            };
          })
        );
        setMessage("تم تحميل مستندات العميل.");
      } else {
        setDocs([{ key: makeId(), docType: "", customName: "", docDate: today() }]);
      }
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRow = async (row: DocRowState) => {
    if (!canEdit) return;
    if (!row.docId) {
      removeRowLocal(row.key);
      return;
    }
    const confirmDelete = window.confirm("سيتم حذف المستند نهائياً، هل تريد المتابعة؟");
    if (!confirmDelete) return;
    try {
      const res = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ docId: row.docId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "تعذر حذف المستند.");
      removeRowLocal(row.key, true);
      setMessage("تم حذف المستند بنجاح.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "تعذر حذف المستند، حاول لاحقاً.");
    }
  };

  const handleSave = async () => {
    if (!clientCode.trim()) {
      setMessage("يرجى إدخال كود العميل.");
      return;
    }
    if (!clientName.trim() && !isExisting) {
      setMessage("يرجى إدخال اسم العميل.");
      return;
    }
    if (!canEdit) {
      setMessage("ليس لديك صلاحية التعديل على هذا العميل.");
      return;
    }
    const rowsToSave = docs.filter((row) => row.docType && (row.file || row.docId));
    if (rowsToSave.length === 0) {
      setMessage("أضف مستنداً واحداً على الأقل.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      if (!isExisting) {
        const createRes = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            clientCode,
            clientName,
            branch: isAdmin ? selectedBranch || userBranch : undefined,
          }),
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error(createData.message || "تعذر إنشاء العميل.");
        setIsExisting(true);
      }
      for (const row of rowsToSave) {
        const baseName = row.docType === OTHER_DOC_TYPE ? row.customName || row.docType : row.docType;
        const docName = baseName.trim();
        const docDateValue = row.docDate || today();
        if (!docName) throw new Error("يرجى إدخال اسم المستند.");
        let fileUrl: string | undefined;
        if (row.file) {
          const formData = new FormData();
          const renamedFile = renameFileWithClientCode(row.file, docName, clientCode.trim());
          formData.append("file", renamedFile);
          formData.append("docName", docName);
          formData.append("docDate", docDateValue);
          const uploadRes = await fetch(
            `/api/archives/upload?clientCode=${encodeURIComponent(clientCode.trim())}`,
            { method: "POST", body: formData }
          );
          const uploadData = await uploadRes.json().catch(() => ({}));
          if (!uploadRes.ok)
            throw new Error(uploadData.message || "تعذر رفع الملف أو الاتصال بالخدمة.");
          fileUrl = extractFileUrl(uploadData);
          if (!fileUrl) throw new Error("لم يتم إرجاع رابط الملف من خدمة الأرشفة.");
        } else if (row.existingPath) {
          fileUrl = row.existingPath;
        } else {
          throw new Error("أرفق ملفاً للمستند.");
        }
        const saveRes = await fetch(`/api/clients/${clientCode.trim()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            docId: row.docId,
            clientName,
            docName,
            docDate: docDateValue,
            fileUrl,
            replaceExisting: true,
          }),
        });
        const saveData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) throw new Error(saveData.message || "تعذر حفظ المستند.");
      }
      setMessage("تم حفظ المستندات بنجاح.");
      await loadClient();
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "تعذر الاتصال بالخادم أو قاعدة البيانات، حاول لاحقاً."
      );
    } finally {
      setLoading(false);
    }
  };

  const docTypeOptions = useMemo(
    () =>
      DOC_TYPES.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      )),
    []
  );

  if (allowed === false) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-lg font-semibold text-rose-600">ليس لديك صلاحية الوصول.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="text-right">
          <p className="text-sm text-[var(--text-muted)]">
            إضافة مستندات لعميل
          </p>
          <h1 className="text-2xl font-semibold text-[var(--text-strong)]">
            إنشاء عميل ورفع مستنداته
          </h1>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 self-start">
              <label className="block text-sm font-medium text-slate-700 text-right">
                كود العميل
              </label>
              <input
                type="text"
                value={clientCode}
                onChange={(e) => setClientCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    loadClient();
                  }
                }}
                className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500`}
                placeholder="اكتب كود العميل"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 text-right">
                اسم العميل
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                readOnly={!clientLoaded}
                onFocus={handleClientNameHint}
                onClick={handleClientNameHint}
                disabled={!canEdit || loading}
                className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-rose-500 ${
                  clientLoaded
                    ? "border-slate-300 focus:ring-sky-500"
                    : "border-rose-500 focus:ring-rose-500"
                }`}
                placeholder="اسم العميل"
              />
              {clientNameHint && !clientLoaded ? (
                <p className="text-base font-semibold !text-rose-600 text-right">
                  {clientNameHint}
                </p>
              ) : null}
            </div>
            {isAdmin ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 text-right">
                  اختر الفرع
                </label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- اختر الفرع --</option>
                  {branches.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={loadClient}
              className="rounded-lg load-data border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-[var(--header-btn-hover)]"
            >
              تحميل بيانات العميل
            </button>
          </div>

          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[var(--text-strong)]">
                  المستندات المراد رفعها
                </h2>
                {!canEdit ? (
                  <span className="text-xs text-rose-600">
                    لا تملك صلاحية التعديل لهذا العميل.
                  </span>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              {docs.map((row) => {
                const showOther = row.docType === OTHER_DOC_TYPE;
                return (
                  <div
                    key={row.key}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-3 space-y-1">
                        <label className="block text-base font-medium text-slate-700 text-right">
                          نوع المستند
                        </label>
                        <select
                          value={row.docType}
                          onChange={(e) =>
                            updateRow(row.key, { docType: e.target.value })
                          }
                          disabled={!canEdit}
                          className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="">-- اختر نوع المستند --</option>
                          {docTypeOptions}
                        </select>
                      </div>

                      {showOther && (
                        <div className="md:col-span-3 space-y-1">
                          <label className="block text-base font-medium text-slate-700 text-right">
                            اسم مخصص
                          </label>
                          <input
                            type="text"
                            value={row.customName}
                            onChange={(e) =>
                              updateRow(row.key, { customName: e.target.value })
                            }
                            disabled={!canEdit}
                            className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
                            placeholder="اكتب اسم المستند"
                          />
                        </div>
                      )}

                      <div className="md:col-span-2 space-y-1 hidden">
                        <label className="block text-base font-medium text-slate-700 text-right">
                          التاريخ
                        </label>
                        <input
                          type="date"
                          value={row.docDate}
                          onChange={(e) =>
                            updateRow(row.key, { docDate: e.target.value })
                          }
                          disabled={!canEdit}
                          className="w-full rounded-lg border border-slate-300 px-3 h-9 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div className="md:col-span-3 space-y-1">
                        <label className="block text-base font-medium text-slate-700 text-right">
                          الملف
                        </label>

                        {row.existingPath && (
                          <a
                            href={`/documents/view/${row.docId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-base text-sky-700 underline font-medium mb-1"
                          >
                            عرض الملف الحالي
                          </a>
                        )}

                        <input
                          id={`file-${row.key}`}
                          type="file"
                          disabled={!canEdit}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            updateRow(row.key, {
                              file,
                              fileLabel: file ? file.name : undefined,
                            });
                          }}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!canEdit}
                            onClick={() => {
                              const el = document.getElementById(
                                `file-${row.key}`
                              ) as HTMLInputElement | null;
                              el?.click();
                            }}
                            className="rounded-lg upload-files border px-4 h-9 text-sm font-semibold shadow-sm hover:shadow disabled:opacity-60"
                          >
                            {row.fileLabel ? "تغيير الملف" : "اختر ملف"}
                          </button>
                          {row.fileLabel && (
                            <span className="text-xs text-slate-500 truncate max-w-[140px]">
                              {row.fileLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row)}
                          disabled={!canEdit}
                          className="rounded-lg bg-rose-600 px-4 h-9 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <button
              type="button"
              onClick={addRow}
              disabled={!canEdit}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 attention-nudge"
            >
              إضافة مستند جديد
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || !canEdit}
              className="rounded-lg bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-70"
            >
              {loading ? "جاري الحفظ..." : "حفظ المستندات"}
            </button>
          </div>

          {message ? (
            <p className="text-lg text-right text-[var(--text-strong)]">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
