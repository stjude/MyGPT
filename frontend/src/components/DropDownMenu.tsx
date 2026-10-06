interface DropdownOptionsProps {
	optionsList: string[],
	width?: string,
	defaultOption?: string,
	disabled?: boolean,
	disabledOptions?: string[],
	dropDownCallback: any
}

const defaultDropdownOptionsProps : DropdownOptionsProps = {
	optionsList: ['ABL1', 'ABL2', 'SRC', 'EGFR' ],
	defaultOption: 'SRC',
	disabled: false,
	dropDownCallback: () => {}
}

// dropdown menu that appears when dropdown button is pressed
export const DropdownOptions = (props = defaultDropdownOptionsProps) => {
	const options = props.optionsList || []
	if (!options.length) return <></>
	const defaultOption = props.defaultOption?.length ? props.defaultOption : options[0]
	return (
		<div className='relative inline-block text-left'>
			<select 
				className={'border border-bsk_dark_blue dark:bg-gray-500 dark:placeholder:text-white dark:text-white rounded focus:ring-blue-500 focus:border-blue-500 block text-sm h-7' + (props.width ? ' w-['+ props.width+']' : ' w-24' )}
				onChange={(e) => props.dropDownCallback(e.target.value)}
				value={props.defaultOption || defaultOption}
				disabled={props.disabled}
			>	
				{options.map((option:string, index:number) => {
					return(
						<option
							key={index} 
							value={option}
							disabled={props.disabledOptions?.includes(option)}
						>
							{option}
						</option>
					)
				}
				)}
			</select>
		</div>
	)
}