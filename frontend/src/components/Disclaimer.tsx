import {useState, useEffect} from 'react'

interface DisclaimerProps {
	disclaimerText: string,
	showAgreementButton: boolean,
	closeDisclaimer: any,
	forceOpenDisclaimer: boolean
}

const Disclaimer = (props: DisclaimerProps) =>{

	const [djangoAuthenticated, setDjangoAuthenticated] = useState(false)
	const [djangoUser, setDjangoUser]:any = useState({})
	const [disclaimerAgreed, setDisclaimerAgreed] = useState(false)



	useEffect(()=>{
		// if access_token is present, get user info
		if (localStorage.getItem('access')) {
		const requestOptions = {
			method: 'POST',
			headers: {
			'Content-Type': 'application/json',
			'Authorization': `${import.meta.env.PROD ? import.meta.env.VITE_AUTH_TOKEN_PROD : import.meta.env.VITE_AUTH_TOKEN_DEV}`
			},
			body: JSON.stringify({
			'access_token': localStorage.getItem('access')
			})
		}


		fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_username/?format=json`, requestOptions)
			.then(response => {
			if (response.status === 401) {
				localStorage.removeItem('access')
				return { 'user': null }
			}
			else
			return response.json()
			})
			.then(data => {
			if (data.username && data.username.length > 0) {
				const user = { 'user': data.username }
				setDjangoAuthenticated(true)
				setDjangoUser(user)
			}
			})
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	},[])

	useEffect(()=>{
		if (djangoAuthenticated && djangoUser && djangoUser.user && djangoUser.user.length > 0) {
			fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/disclaimer_agreements/?format=json`, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json',
				}})
				.then(response => response.json())
				.then(data => {
					if (data.results?.length > 0 && data.results.filter((agreement:any) => agreement.user === djangoUser.user).length > 0) {
						setDisclaimerAgreed(true)
					}
				})
		}
	},[djangoUser, djangoAuthenticated])

	const handeleAgreementSubmit = () => {
		const requestOptions = {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `${import.meta.env.PROD ? import.meta.env.VITE_AUTH_TOKEN_PROD : import.meta.env.VITE_AUTH_TOKEN_DEV}`
			},
			body: JSON.stringify({
				'username': djangoUser.user
			})
		}

		fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/submit_disclaimer_agreement/?format=json`, requestOptions)
			.then(response => response.json())
			.then(data => {
				console.log('Success:', data)
				setDisclaimerAgreed(true)
			})
	}

	return (
		(disclaimerAgreed && !props.forceOpenDisclaimer ? <></> :
		<div className='fixed inset-0 z-50 bg-black bg-opacity-70 flex items-center justify-center'>
			<div className={'bg-panel1 w-3/4 max-h-[750px] max-w-[1200px] rounded-lg ' + (window.screen.availHeight < 1000 ? 'h-[75vh]' : 'h-[65vh]')}>
				<div className='flex justify-between'>
					<div className='text-2xl font-bold text-white mt-8 mx-8'>Limited Access Statement</div>
					{djangoAuthenticated && !disclaimerAgreed ?
					<></>:
					<div className='text-2xl font-bold text-white mt-8 mr-8 cursor-pointer' onClick={props.closeDisclaimer}>x</div>}
				</div>
				<div className='bg-panel2 w-full my-2 py-2 h-[85%]'>
					<div className='text-nav m-8'>
						<div dangerouslySetInnerHTML={{__html: props.disclaimerText}}></div>

					</div>
					<div className='flex justify-center'>
						{ djangoAuthenticated && !disclaimerAgreed ? 
						<button className='bg-bsk_dark_blue text-white py-2 px-4 rounded-lg my-4' onClick={()=>handeleAgreementSubmit()}>I Agree</button> : <></>}
					</div>
				</div>
			</div>
		</div>
		)
	)
}

export default Disclaimer