import { useEffect, useState } from 'react'
import { MathJaxContext, MathJax } from 'better-react-mathjax'

export const RelevanceScoreSettings = (props: any) => {
	const [embeddingModel, setEmbeddingModel]:[any, any] = useState(undefined)
	const currentSettings = JSON.parse(JSON.stringify(props.currentSettings))
	const [QRSbest, setQRSbest] = useState(currentSettings.relevance_score_cutoff.question_best)
	const [QRSworst, setQRSworst] = useState(currentSettings.relevance_score_cutoff.question_worst)
	const [defaultQRSbest, setDefaultQRSbest] = useState(currentSettings.relevance_score_cutoff.question_best)
	const [defaultQRSworst, setDefaultQRSworst] = useState(currentSettings.relevance_score_cutoff.question_worst)
	const [ARSbest, setARSbest] = useState(currentSettings.relevance_score_cutoff.answer_best)
	const [ARSworst, setARSworst] = useState(currentSettings.relevance_score_cutoff.answer_worst)
	const [defaultARSbest, setDefaultARSbest] = useState(currentSettings.relevance_score_cutoff.answer_best)
	const [defaultARSworst, setDefaultARSworst] = useState(currentSettings.relevance_score_cutoff.answer_worst)
	const [HIa, setHIa] = useState(currentSettings.relevance_score_cutoff.HIa)
	const [HIb, setHIb] = useState(currentSettings.relevance_score_cutoff.HIb)
	const [HIc, setHIc] = useState(currentSettings.relevance_score_cutoff.HIc)


	// get current embedding model from backend API
	useEffect(()=>{
		if (embeddingModel === undefined) {
		const requestOptions = {
			method: 'GET',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `${
						props.user && props.djangoLogin ?
						'Bearer ' + localStorage.getItem('access') :
						import.meta.env.PROD ? 
						import.meta.env.VITE_AUTH_TOKEN_PROD 
						: import.meta.env.VITE_AUTH_TOKEN_DEV}`
			}
		}
		fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_embedding_model_details/?dataset=${props.selectedDataset}&format=json`, requestOptions)
			.then(response => response.json())
			.then(data => {
				if (data) {
					setEmbeddingModel(data)
					const embeddingmodel = data.embedding_model
					const q_best = embeddingmodel.best_distance_q
					const q_worst = embeddingmodel.worst_distance_q
					const buffer5 = (q_worst - q_best) * 0.05
					if (currentSettings.use_default_qrs) {
						setQRSbest(q_best - buffer5)
						setQRSworst(q_worst + buffer5)
					}
					setDefaultQRSbest(q_best - buffer5)
					setDefaultQRSworst(q_worst + buffer5)

					const ac_scores = [embeddingmodel.best_distance_ac, embeddingmodel.worst_distance_ac]
					const a_best = Math.min(...ac_scores)
					const a_worst = Math.max(...ac_scores)
					const buffer5a = (a_worst - a_best) * 0.05
					if (currentSettings.use_default_ars) {
						setARSbest(a_best - buffer5a)
						setARSworst(a_worst + buffer5a)
					}
					setDefaultARSbest(a_best - buffer5a)
					setDefaultARSworst(a_worst + buffer5a)
				}
			})
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[props.selectedDataset])


	return (
		<div className='px-8 py-2 flex flex-col divide-y'>
			<MathJaxContext
				hideUntilTypeset={'first'}
				onStartup={(mathJax: any) => {
					const origTypesetPromise = mathJax.typesetPromise.bind(mathJax);
					const origTypesetClear = mathJax.typesetClear.bind(mathJax);
					mathJax.typesetPromise = (elements?: (HTMLElement | null)[]) => {
						const safe = elements ? elements.filter(Boolean) : [];
						if (safe.length === 0) return Promise.resolve();
						return origTypesetPromise(safe);
					};
					mathJax.typesetClear = (elements?: (HTMLElement | null)[]) => {
						const safe = elements ? elements.filter(Boolean) : [];
						if (safe.length > 0) origTypesetClear(safe);
					};
				}}
			>
			<div className='m-2'>
			<div className='text-nav dark:text-nav-dark p-1 my-2'><span className='font-bold'>Notes</span> 
				<ul className='list-disc'>
					<li>This is an advanced setting. Please refer to the documentation to adjust QRS, ARS, and HI calculations.</li>
					<li>Editing QRS, ARS, and HI calculation will only take effect for subsequent Q&A with the current library. It will not change scores for previous Q&A and will reset when you change the library.</li>
				</ul>
			</div>
				<div className='my-4 border-slate-200 py-2 border-y-2'>
					<div className='text-nav dark:text-nav-dark inline-block px-2 my-2 text-lg font-semibold'>Question relevance score (QRS) range</div>
					<div className='mx-4 px-2 w-[200px]'>
						<div>
							<div className='w-24 p-1 m-1 inline-block text-nav dark:text-nav-dark text-2xl'><MathJax>{"\\(QRS = 1 - \\frac{QC_{mean} - QC_{best}}{QC_{worst} - QC_{best}} \\)"}</MathJax></div>
						</div>

						<div className='flex justify-between'>
							<div className='text-nav dark:text-nav-dark p-1 my-1 text-xl'><MathJax>{"\\(QC_{best} \\)"}</MathJax></div>
							<input type='number' placeholder='Best' className='rounded-md w-24 p-1 m-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark' value={QRSbest} onChange={(e)=>setQRSbest(e.target.value)}/>
						</div>
						<div className='flex justify-between'>
							<div className='text-nav dark:text-nav-dark p-1 my-1 text-xl'><MathJax>{"\\(QC_{worst} \\)"}</MathJax></div>
							<input type='number' placeholder='Worst' className='rounded-md w-24 p-1 m-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark' value={QRSworst} onChange={(e)=>setQRSworst(e.target.value)}/>
						</div>
					</div>
					<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={()=>props.settingsCallback({...currentSettings, use_default_qrs: false, relevance_score_cutoff: {...currentSettings.relevance_score_cutoff, question_best: parseFloat(QRSbest), question_worst: parseFloat(QRSworst)}})}>Save</button>
					<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={()=>props.settingsCallback(()=>{
							setQRSbest(defaultQRSbest)
							setQRSworst(defaultQRSworst)
							return {...currentSettings, use_default_qrs: true, relevance_score_cutoff: {...currentSettings.relevance_score_cutoff, question_best: parseFloat(defaultQRSbest), question_worst: parseFloat(defaultQRSworst)}}
						})}>Reset</button>
				</div>
				<div className='my-4 border-slate-200 py-2 border-b-2'>
					<div className='text-nav dark:text-nav-dark inline-block px-2 my-2 text-lg font-semibold'>Answer relevance score (ARS) range</div>
					<div className='mx-4 px-2 w-[200px]'>
						<div>
							<div className='w-24 p-1 m-1 block text-nav dark:text-nav-dark text-2xl '><MathJax>{"\\(ARS = 1 - \\frac{AC_{mean} - AC_{best}}{AC_{worst} - AC_{best}} \\)"}</MathJax></div>
						</div>
						<div className='flex justify-between'>
							<div className='text-nav dark:text-nav-dark p-1 my-1 text-xl'><MathJax>{"\\(AC_{best} \\)"}</MathJax></div>
							<input type='number' placeholder='Best' className='rounded-md w-24 p-1 m-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark' value={ARSbest} onChange={(e)=>setARSbest(e.target.value)}/>
						</div>
						<div className='flex justify-between'>
							<div className='text-nav dark:text-nav-dark p-1 my-1 text-xl'><MathJax>{"\\(AC_{worst} \\)"}</MathJax></div>
							<input type='number' placeholder='Worst' className='rounded-md w-24 p-1 m-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark' value={ARSworst} onChange={(e)=>setARSworst(e.target.value)}/>
						</div>
					</div>
					<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={()=>props.settingsCallback({...currentSettings, use_default_ars: false, relevance_score_cutoff: {...currentSettings.relevance_score_cutoff, answer_best: parseFloat(ARSbest), answer_worst: parseFloat(ARSworst)}})}>Save</button>
					<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={()=>props.settingsCallback(()=>{
							setARSbest(defaultARSbest)
							setARSworst(defaultARSworst)
							return {...currentSettings, use_default_ars: true, relevance_score_cutoff: {...currentSettings.relevance_score_cutoff, answer_best: parseFloat(defaultARSbest), answer_worst: parseFloat(defaultARSworst)}}
						})}>Reset</button>
				</div>
				<div className='my-4 py-2'>
					<div className='text-nav dark:text-nav-dark inline-block px-2 my-2 text-lg font-semibold'>Hallucination Index coefficients</div>
					<div>
						<div className='w-24 p-1 m-1 inline-block text-nav dark:text-nav-dark text-lg'><MathJax>{"\\(HI = a - b  (QRS) - c (ARS)\\)"}</MathJax></div>
					</div>
					<div className='mx-4 px-2 w-[200px]'>
						<div className='flex justify-between'>
							<div className='text-nav dark:text-nav-dark p-1 my-1 text-xl'><MathJax>{"\\(a \\)"}</MathJax></div>
							<input type='number' placeholder='a' className='rounded-md w-24 p-1 m-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark' value={HIa} onChange={(e)=>setHIa(e.target.value)}/>
						</div>
						<div className='flex justify-between'>
							<div className='text-nav dark:text-nav-dark p-1 my-1 text-xl'><MathJax>{"\\(b \\)"}</MathJax></div>
							<input type='number' placeholder='b' className='rounded-md w-24 p-1 m-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark' value={HIb} onChange={(e)=>setHIb(e.target.value)}/>
						</div>
						<div className='flex justify-between'>
							<div className='text-nav dark:text-nav-dark p-1 my-1 text-xl'><MathJax>{"\\(c \\)"}</MathJax></div>
							<input type='number' placeholder='c' className='rounded-md w-24 p-1 m-1 dark:text-white dark:bg-gray-500 dark:placeholder:text-nav-dark' value={HIc} onChange={(e)=>setHIc(e.target.value)}/>
						</div>
					</div>
					<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={()=>props.settingsCallback({...currentSettings, use_default_hi: false, relevance_score_cutoff: {...currentSettings.relevance_score_cutoff, HIa: parseFloat(HIa), HIb: parseFloat(HIb), HIc: parseFloat(HIc)}})}>Save</button>
						<button className='bg-panel1 dark:bg-panel3-dark text-white px-4 py-1 rounded-md mx-4 my-2' onClick={()=>props.settingsCallback(()=>{
							setHIa(1)
							setHIb(0.5)
							setHIc(0.5)
							return {...currentSettings, use_default_hi: true, relevance_score_cutoff: {...currentSettings.relevance_score_cutoff, HIa: 1, HIb: 0.5, HIc: 0.5}}
						})}>Reset</button>
				</div>
			</div>
			</MathJaxContext>
		</div>
	);
}

export default RelevanceScoreSettings