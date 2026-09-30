import './App.css'
import { useState, useEffect } from 'react'
import TopNav from './components/TopNav'
import GPTHome from './components/GPTHome'
import Settings from './components/Settings'
import UploadMenu from './components/UploadMenu'
import defaultSettings from './utils/DefaultState'
import ChatHistory from './components/ChatHistory'
import Disclaimer from './components/Disclaimer'
import FAQ from './components/FAQ'
import Footer from './components/Footer'
// import Plots from './components/Plots'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './utils/authConfigEnv'

const msalInstance = new PublicClientApplication(msalConfig)

const default_frontend_settings = {
  'show_no_context_switch': true,
  'azure_login': false, 
  'django_login': false,
  'restriction_without_login': false,
  'disable_chat_without_login': false,
}

function App() {  
  const [currentSettings, setCurrentSettings] = useState(defaultSettings)
  const [showSettings, setShowSettings] = useState(currentSettings.showSettings || defaultSettings.showSettings)
  const [showUpload, setShowUpload] = useState(currentSettings.showUpload || defaultSettings.showUpload)

  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [forceopenDisclaimer, setForceOpenDisclaimer] = useState(false)

  const [showChatHistory, setShowChatHistory] = useState(false)
  const [showPlotButton, setShowPlotButton] = useState(false)
  const [frontendSettings, setFrontendSettings] = useState<any>(default_frontend_settings)
  const [user, setUser] = useState<any>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [showFAQ, setShowFAQ] = useState(currentSettings.showFAQ || defaultSettings.showFAQ)

  const settingsCallback = (newSettings:any) => {
    newSettings.restriction_without_login = frontendSettings.restriction_without_login
    setCurrentSettings(newSettings)
    if (newSettings.showSettings){
      setShowSettings(newSettings.showSettings)
    }
  }

  const loginCallback = (user:any) => {
    setUser(user)
    currentSettings.fetchDatasets = true
  }

  const DarkModeCallback = () => {
    setDarkMode(!darkMode)
    setCurrentSettings({...currentSettings, darkMode:!darkMode})
  }

  useEffect(()=>{
		const requestOptions = {
			method: 'GET',
			headers: { 
				'Content-Type': 'application/json'
			}
		}
		fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/frontend_settings/?format=json`, requestOptions)
			.then(response => response.json())
			.then(data => {
				setFrontendSettings(data.settings)
        if (data.settings.django_login)
          setShowDisclaimer(true)
			})
			.catch(err => {
				console.warn('frontend_settings: backend unreachable', err)
			})
	},[])

  //  set currentsettings login to true
  useEffect(()=>{
    if (user && user.user.length > 0 && currentSettings.loggedin === false) {
      setCurrentSettings({...currentSettings, loggedin:true})
    }
  }, [user, currentSettings])

  // get datasets when user login
  useEffect(()=>{
    if (user && ((user.user_email && user.user_email.length > 0) || (user.group && user.group.length > 0)) && currentSettings.fetchDatasets === true) {
        const requestOptions = {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `${
              frontendSettings.django_login ?
              'Bearer ' + localStorage.getItem('access') :
              import.meta.env.PROD ? 
              import.meta.env.VITE_AUTH_TOKEN_PROD 
              : import.meta.env.VITE_AUTH_TOKEN_DEV}`
          },
          body: JSON.stringify({
            'user_email': user.user_email,
            'user_group': user.otherRoles?.length ? user.otherRoles[0] : ''
          })
        }
        fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_datasets/?format=json`, requestOptions)
          .then(response => response.json())
          .then(data => {
            currentSettings.datasets = currentSettings.datasets.filter((d:any)=>d !== 'None')
            setCurrentSettings({...currentSettings, datasets:data.map((d:any)=>d.dataset_name), selectedDataset:data[0].dataset_name, fetchDatasets:false})
          })
          .catch(err => {
            console.warn('get_datasets: backend unreachable', err)
          })
        } 
        else if ((currentSettings.selectedDataset === 'None' || currentSettings.datasetsUpdated === true) && currentSettings.fetchDatasets === true) {
          const requestOptions = {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `${
                frontendSettings.django_login ?
                'Bearer ' + localStorage.getItem('access') :
                import.meta.env.PROD ?
                import.meta.env.VITE_AUTH_TOKEN_PROD 
                : import.meta.env.VITE_AUTH_TOKEN_DEV}`
            },
            body: JSON.stringify({
              'user_email': '',
              'user_group': ''
            })
          }
          if ((frontendSettings.django_login && localStorage.getItem('access')?.length) || !frontendSettings.django_login) {
            fetch(`${window.mygptRuntimeConfig.backendApiUrl}api/get_datasets/?format=json`, requestOptions)
            .then(response => {
              if(response.ok){
                return response.json()
              }
            })
              .then(data => {
                currentSettings.datasets = currentSettings.datasets.filter((d:any)=>d !== 'None')
                if(data && data.length > 0)
                  setCurrentSettings({...currentSettings, datasets:data.map((d:any)=>d.dataset_name), selectedDataset:data[0].dataset_name, fetchDatasets:false, datasetsUpdated:false})
            })
            .catch(err => {
              console.warn('get_datasets: backend unreachable', err)
            })
          }
        }
    }, [user, currentSettings, frontendSettings.django_login])

  return (
    <div className={`h-screen max-h-screen w-full overflow-hidden flex flex-col justify-between bg-gray-200 dark:bg-neutral-900 ${darkMode ? 'dark': ''}`}>
    { frontendSettings.azure_login ?
      <MsalProvider instance={msalInstance}>
        <div className='flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-200 dark:bg-neutral-800'>
        <TopNav
          setShowUpload={setShowUpload}
          setShowSettings={setShowSettings} 
          setShowChatHistory={setShowChatHistory} 
          setPlotButton={setShowPlotButton}
          showLoginButton={frontendSettings.azure_login}
          restrictions={frontendSettings.restriction_without_login}
          loginCallback={loginCallback}
          darkMode={darkMode}
          darkModeCallback={DarkModeCallback}
        />
        {showUpload ?
          <UploadMenu
            closeUpload={() => setShowUpload(false)}
            openSettings={() => setShowSettings(true)}
            currentSettings={currentSettings}
            settingsCallback={settingsCallback}
            user={user}
            djangoLogin={frontendSettings.django_login}
          /> : <></>
        }
        {showSettings ?
          <Settings 
            closeSettings={() => setShowSettings(false)}
            openUpload={() => { 
              setShowSettings(false); 
              setShowUpload(true);
              currentSettings.showSettings = false
              currentSettings.showUpload = true
            }}
            defaultSettings={defaultSettings} 
            currentSettings={currentSettings}
            settingsCallback={settingsCallback}
            user={user}
          /> 
          : <></>}
        {showChatHistory ? 
          <ChatHistory
            closeChatHistory={() => setShowChatHistory(false)}
            dataset = {currentSettings.selectedDataset}
            datasets = {currentSettings.datasets}
            darkMode={darkMode} 
          /> : <></>
        }
        {showPlotButton ?
            // <Plots
            //   closePlots={() => setShowPlotButton(false)}
            //   datasets = {currentSettings.datasets}   
            // />
            <></> : <></>
          }
        <GPTHome 
          currentSettings={currentSettings} 
          settingsCallback={settingsCallback} 
          frontendSettings={frontendSettings}
          user={user}
        />
        {showFAQ?
       <FAQ 
        closeFAQ={()=>setShowFAQ(false)}/> : <></>
        } 
        </div>
      </MsalProvider>
    : 
    frontendSettings.django_login ?
    <div className='flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-200 dark:bg-neutral-800'>
      <TopNav 
        setShowUpload={()=>{
          setShowUpload(true)
          currentSettings.showUpload = true
        }}
        setShowSettings={()=>{
          setShowSettings(true)
          currentSettings.showSettings = true
        }} 
        setShowChatHistory={setShowChatHistory} 
        setPlotButton={setShowPlotButton}
        showPopupLogin={frontendSettings.django_login}
        showLoginButton={frontendSettings.django_login}
        loginCallback={loginCallback}
        darkModeCallback={DarkModeCallback}
      />
      {showUpload ?
        <UploadMenu
          closeUpload={() => {
            setShowUpload(false)
            currentSettings.showUpload = false
          }}
          openSettings={() => {
            setShowSettings(true)
            currentSettings.showSettings = true
          }}
          currentSettings={currentSettings}
          settingsCallback={settingsCallback}
          user={user}
          djangoLogin={frontendSettings.django_login}
        /> : <></>
      }
      {showSettings ?
        <Settings 
          closeSettings={() => {
            setShowSettings(false)
            currentSettings.showSettings = false
          }}
          openUpload={() => { setShowSettings(false); setShowUpload(true); }}
          defaultSettings={defaultSettings} 
          currentSettings={currentSettings}
          settingsCallback={settingsCallback}
          djangoLogin={!frontendSettings.django_login}
          user={user}
        /> 
        : <></>}
      {showChatHistory ? 
        <ChatHistory
          closeChatHistory={() => setShowChatHistory(false)}
          dataset = {currentSettings.selectedDataset}
          datasets = {currentSettings.datasets}
          darkMode={darkMode} 
        /> : <></>
      }
      {showPlotButton ?
        // <Plots
        //   closePlots={() => setShowPlotButton(false)}
        //   datasets = {currentSettings.datasets}   
        // />
        <></> : <></>
      }
      {showDisclaimer ?
        <Disclaimer
          disclaimerText={defaultSettings.disclaimer_text}
          showAgreementButton={currentSettings.loggedin} 
          closeDisclaimer={() => setShowDisclaimer(false)}
          forceOpenDisclaimer={forceopenDisclaimer}
        /> :
        <></>
      }
      <GPTHome 
        currentSettings={currentSettings} 
        settingsCallback={settingsCallback} 
        frontendSettings={frontendSettings}
        user={user}
      />
      {showFAQ?
       <FAQ 
       closeFAQ={()=>setShowFAQ(false)}/> : <></>
      }
    </div>
    :
    <div className='flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-200 dark:bg-neutral-800'>
      <TopNav 
        setShowUpload={setShowUpload}
        setShowSettings={setShowSettings} 
        setPlotButton={setShowPlotButton} 
        setShowChatHistory={setShowChatHistory} 
        showLoginButton={frontendSettings.azure_login}
        loginCallback={()=>{}}
        darkModeCallback={DarkModeCallback}
      />
      {showUpload ?
        <UploadMenu
          closeUpload={() => setShowUpload(false)}
          openSettings={() => setShowSettings(true)}
          currentSettings={currentSettings}
          settingsCallback={settingsCallback}
          user={user}
          djangoLogin={frontendSettings.django_login}
        /> : <></>
      }
      {showSettings ?
        <Settings 
          closeSettings={() => setShowSettings(false)}
          openUpload={() => { setShowSettings(false); setShowUpload(true); }}
          defaultSettings={defaultSettings} 
          currentSettings={currentSettings}
          settingsCallback={settingsCallback}
        /> 
        : <></>}
      {showChatHistory ? 
        <ChatHistory
          closeChatHistory={() => setShowChatHistory(false)}
          dataset = {currentSettings.selectedDataset}
          datasets = {currentSettings.datasets}
          darkMode={darkMode} 
        /> : <></>}
      <GPTHome 
        currentSettings={currentSettings} 
        settingsCallback={settingsCallback} 
        frontendSettings={frontendSettings}
        user={user}
      />
      {showFAQ?
       <FAQ 
       closeFAQ={()=>setShowFAQ(false)}/> : <></>
      } 
    </div>
  }
  {/* add footer */}
  <Footer 
    frontendSettings={frontendSettings}
    onDisclaimerClick={()=>{
      setForceOpenDisclaimer(true)
      setShowDisclaimer(!showDisclaimer)
    }}
    onFAQClick={()=>{
      setShowFAQ(!showFAQ)
    }}
  />
	</div>
  )
}

export default App