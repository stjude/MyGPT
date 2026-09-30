import * as THREE from 'three'
import { useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { scaleOrdinal } from 'd3'

interface plotsProps {
	closePlots: any,
	datasets: string[],
}

const Plots = (props: plotsProps) => {
	const [selectedDatasets, setSelectedDatasets] = useState(props.datasets)
	const [pointGeometries, setPointGeometries]:[any,any] = useState([])
	// const [pointsPositions, setPointsPositions] = useState([])
	const [pointPositionsByDataset, setPointPositionsByDataset]:[any,any] = useState([])

	const [questionPointsPositions, setQuestionPointsPositions] = useState([])
	const [answerPointsPositions, setAnswerPointsPositions] = useState([])
	const [chunksPointsPositions, setChunksPointsPositions] = useState([])
	const [questionGeometries, setQuestionGeometries]:[any,any] = useState([])
	const [answerGeometries, setAnswerGeometries]:[any,any] = useState([])
	const [chunksGeometries, setChunksGeometries]:[any,any] = useState([])

	const [pointsColors, setPointsColors] = useState([])
	// const PCDloader = new THREE.Loader()
	// const points = new THREE.Points()
	// const colors = scaleOrdinal(schemeCategory10)
	const customColorScale = ['#1f77b4', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#17becf', '#393b79', '#637939', '#aec7e8', '#98df8a', '#c5b0d5', '#c49c94', '#f7b6d2', ' #c7c7c7', '#9edae5']
	const chunksColor = '#FFA338'
	const questionColor = '#E83331'
	// const answerColor = '#E83331'
	const answerColor = '#2ca02c'
	// add question, answer and chunk colors at beginning of customColorScale
	customColorScale.unshift(chunksColor)
	customColorScale.unshift(answerColor)
	customColorScale.unshift(questionColor)
	const customColors = scaleOrdinal(customColorScale)

	useEffect(() => {
		if (props.datasets.length && !props.datasets.includes('None')) {
			const requestOptions = {
				method: 'GET',
				headers: { 
					'Content-Type': 'application/json'
				}
			}
			// fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_vector_embeddings/?format=json&datasets=${selectedDatasets}&question_id=817`, requestOptions)
			// fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_vector_embeddings/?format=json&datasets=${selectedDatasets}`, requestOptions)
			fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_vector_embeddings/?format=json&datasets=GPCR_PCA_n,Harry_Potter_book_1_n,IDR_PCA_n&question_id=6982`, requestOptions)
				.then(response => response.json())
				.then(data => {
					const point_dataset:any = data.pca_embeddings.map((point:any) => point.dataset)
					let unique_datasets:any = Array.from(new Set(point_dataset))
					setPointsColors(unique_datasets.map((dataset:any) => customColors(dataset)))
					// remove 'question', 'answer' and ''source' from datasets
					unique_datasets = unique_datasets.filter((dataset:any) => !['question', 'answer', 'source'].includes(dataset))

					const points_by_datasets = unique_datasets.map((dataset:any) => data.pca_embeddings
						.filter((point:any) => point.dataset === dataset))
					const positions_by_datasets:any = []
					unique_datasets.forEach((dataset:any, index:number) => {
						const points = points_by_datasets[index].map((point:any) => [point.pca_x, point.pca_y, point.pca_z])
						positions_by_datasets.push({'dataset':dataset, 'points':points})
					})
					const geometries = positions_by_datasets.map((_dataset:any) => new THREE.BufferGeometry())
					setPointGeometries(geometries)
					setPointPositionsByDataset(positions_by_datasets)

					const question_points = data.pca_embeddings.filter((point:any) => point.dataset === 'question').map((point:any) => [point.pca_x, point.pca_y, point.pca_z])
					setQuestionPointsPositions(question_points)
					// const question_geometries = new THREE.BufferGeometry()
					// setQuestionGeometries(question_geometries)
					const answer_points = data.pca_embeddings.filter((point:any) => point.dataset === 'answer').map((point:any) => [point.pca_x, point.pca_y, point.pca_z])
					setAnswerPointsPositions(answer_points)
					// const answer_geometries = new THREE.BufferGeometry()
					// setAnswerGeometries(answer_geometries)
					const chunks_points = data.pca_embeddings.filter((point:any) => point.dataset === 'source').map((point:any) => [point.pca_x, point.pca_y, point.pca_z])
					setChunksPointsPositions(chunks_points)
					// const chunks_geometries = new THREE.BufferGeometry()
					// setChunksGeometries(chunks_geometries)
					// const positions = data.pca_embeddings.map((point:any) => [point.pca_x, point.pca_y, point.pca_z])
					// setPointsPositions(positions)
				})
		}
		
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[selectedDatasets])

	useEffect(() => {
		pointGeometries.forEach((geometry:any, index:number) => {
			geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pointPositionsByDataset[index].points.flat()), 3))
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pointPositionsByDataset])

	useEffect(() => {
		if (questionPointsPositions.length > 0) {
			const questionGeometries = new THREE.BufferGeometry()
			questionGeometries.setAttribute('position', new THREE.BufferAttribute(new Float32Array(questionPointsPositions.flat()), 3))
			setQuestionGeometries(questionGeometries)
		}
		if (answerPointsPositions.length > 0) {
			const answerGeometries = new THREE.BufferGeometry()
			answerGeometries.setAttribute('position', new THREE.BufferAttribute(new Float32Array(answerPointsPositions.flat()), 3))
			setAnswerGeometries(answerGeometries)
		}
		if (chunksPointsPositions.length > 0) {
			const chunksGeometries = new THREE.BufferGeometry()
			chunksGeometries.setAttribute('position', new THREE.BufferAttribute(new Float32Array(chunksPointsPositions.flat()), 3))
			setChunksGeometries(chunksGeometries)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [questionPointsPositions, answerPointsPositions, chunksPointsPositions])

  return (
	<div className='fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center'>
		<div className={'bg-panel1 w-3/4 max-h-[1100px] max-w-[1200px] rounded-lg ' + (window.screen.availHeight < 1000 ? 'h-[95vh]' : 'h-[75vh]')}>
			<div className='flex justify-between'>
				<div className='text-2xl font-bold text-white mt-8 mx-8 py-4'>Vector space</div>
				<div className='text-2xl font-bold text-white mt-8 mr-8 cursor-pointer' onClick={props.closePlots}>x</div>
			</div>
			<div className='bg-panel2 w-full py-2'>
				{/* add legend for datasets */}
				<div className='flex justify-center'>
					{pointPositionsByDataset.map((ds:any, index:number) => 
						<div key={index} className='flex items-center mx-4' onClick={()=>{
							if (selectedDatasets.includes(ds.dataset)) {
								setSelectedDatasets(selectedDatasets.filter((dataset) => dataset !== ds.dataset))
							} else {
								setSelectedDatasets([...selectedDatasets, ds.dataset])
							}
						}}>
							<div className='h-4 w-4 rounded-full' style={{backgroundColor: pointsColors[index+3]}}></div>
							<div className='text-nav mx-2'>{ds.dataset}</div>
						</div>
					)}
					<div className='flex items-center mx-4'>
						<div className='h-4 w-4 rounded-full' style={{backgroundColor: questionColor}}></div>
						<div className='text-nav mx-2'>Question</div>
					</div>
					<div className='flex items-center mx-4'>
						<div className='h-4 w-4 rounded-full' style={{backgroundColor: chunksColor}}></div>
						<div className='text-nav mx-2'>Retrived chunks</div>
					</div>
					<div className='flex items-center mx-4'>
						<div className='h-4 w-4 rounded-full' style={{backgroundColor: answerColor}}></div>
						<div className='text-nav mx-2'>Answer</div>
					</div>
				</div>
				{/* {
					props.datasets.length > 1 ?
					<select className='text-white bg-panel1 w-1/4 h-10 rounded-lg mx-8 my-4' onChange={(e) => {
						if (selectedDatasets.includes(e.target.value)) {
							setSelectedDatasets(selectedDatasets.filter((dataset) => dataset !== e.target.value))
						} else {
							setSelectedDatasets([...selectedDatasets, e.target.value])
						}
					}}>
						{props.datasets.map((dataset) => <option key={dataset} value={dataset}>{dataset}</option>)}
					</select> : <></>
				} */}
			</div>
			<div className='bg-white m-4 h-[80%]'>
				<Canvas frameloop='demand' camera={{position: [75,1,1], zoom: 20}}>
					<ambientLight intensity={Math.PI / 2} />
					<spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
					<pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
						{ pointPositionsByDataset.map((_dataset:any, index:number) =>
							<mesh position={[0, 0, 0]} key={index}>
								<points geometry={pointGeometries[index]}>
									<pointsMaterial size={2} color={pointsColors[index+3]}/>
								</points>
							</mesh>
						)}
						{ questionPointsPositions.length > 0 ?
							<mesh position={[0, 0, 0]}>
								<points geometry={questionGeometries}>
									<pointsMaterial size={10} color={pointsColors[0]} />
								</points>
							</mesh> : <></>
						}
						{ answerPointsPositions.length > 0 ?
							<mesh position={[0, 0, 0]}>
								<points geometry={answerGeometries}>
									<pointsMaterial size={10} color={pointsColors[1]} />
								</points>
							</mesh> : <></>
						}
						{ chunksPointsPositions.length > 0 ?
							<mesh position={[0, 0, 0]}>
								<points geometry={chunksGeometries}>
									<pointsMaterial size={10} color={pointsColors[2]} />
								</points>
							</mesh> : <></>
						}
					<OrbitControls />
				</Canvas>
			</div>
		</div>
	</div>
  )
}

export default Plots